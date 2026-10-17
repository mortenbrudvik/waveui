# WaveUI 0.8.0 Phase 3 — P3-toasts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rich toasts for 0.8.0: a compound `Toast` (`Toast.Title`, `Toast.Body`, `Toast.Footer`, `Toast.Close` and an `icon` slot), one focusable, named container per toast on the presence core, `dispatchToast(content, options?)`, announcements read from what the toast renders, Toaster keyboard access (a focus shortcut, Escape, Delete and Backspace) with region-wide pausing, and a server-safe `createToaster()` handle.

**Architecture:** `Toast.tsx` is split the way `Menu.tsx` was in 0.7 (spec D32): `Toast.tsx` holds only the compound, its docblock and re-exports (nothing imports it but the barrel); `Toast.root.tsx` the visual; `Toast.parts.tsx` the parts; `Toast.context.ts` the contexts; `Toaster.tsx` the controller, timers, the per-toast container and the live regions. One per-toast context, provided by a standalone Toast and by the Toaster's container, lets the parts and the Toast register their elements, so the container is labelled, described, timed and announced from what actually renders. `src/lib/toaster.ts` imports only types (server-safe): the options recogniser `isToastOptions`, the handle and its internal binding.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 (`cn` = clsx + tailwind-merge), Vitest + React Testing Library + jsdom + vitest-axe, Storybook 10

**Spec:** `docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md` — §0.3 D9–D14, D29, D32, D33; §2 P3-02, P3-01, P3-03, P3-08 (implemented in that order); §3 (the `P3-toasts` row); §4.1, §4.2; §6.4 (the `P3-toasts` bullets); §6.3 checklist items 2 and 6 (manual evidence, Task T16).

**Index:** `docs/superpowers/plans/2026-09-26-fluent-parity-phase-3.md` (wave order, entry conditions, cross-package contract, final gate).

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

- `src/lib/toaster.ts` stays server-safe: only `import type` statements, no DOM access at import; `typeof window === 'undefined'` is its one environment check (a dispatch on the server does nothing).
- One-way imports (D32): `Toast.tsx` → `Toast.root.tsx` → `Toast.parts.tsx` → `Toast.context.ts`; `Toaster.tsx` → `Toast.root.tsx`, `Toast.context.ts`, `src/lib/toaster.ts`; `Toast.context.ts` and `src/lib/toaster.ts` import only types from `Toaster.tsx`. Nothing imports `Toast.tsx` but the barrel.
- `src/components/feedback/index.ts` is not edited (INTEGRATION's): `Toast.tsx` re-exports everything the barrel imports from it (`Toast`, `Toaster`, `useToastController`, `ToastProps`, `ToasterProps`, `ToastOptions`, `ToastController`, `ToastPosition`), so no barrel change is needed in wave B; new stories import `createToaster` from `'../src/lib/toaster'` until Task I1.
- Wave-B tests use only the foundation, 0.7 APIs and this package's own APIs (spec §0.2 rule 9); MessageBar, color and tree parts inside toasts are INTEGRATION's (§4.4).
- Timer-exact tests use `vi.useFakeTimers()` without `shouldAdvanceTime` (the convention of the 0.7 Toast suites, so the 1 ms boundaries stay exact) and `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.

## Review Focus

1. **A toast re-dispatched by `toastId` with a different part set** (Title + Body → Body only → Title only with `statusLabel: ''`): the container's `aria-labelledby` falls back to the severity text alone, then to the title alone, `aria-describedby` goes with the Body, and no ARIA id reference dangles after any update → Task T7.
2. **An empty title action or footer** (`action={canUndo && <Button>Undo</Button>}`, `<Toast.Footer>{canRetry && …}</Toast.Footer>` rendering nothing): the toast holds no action, so the 5 s timeout stays → Task T8.
3. **Two dispatches with the same `toastId` in one tick** (one `act`, one event handler): one toast, the second dispatch's content, one timer and one announcement (the second) → Task T7 (rendering) and Task T10 (announcement).
4. **`Toast.Close` around a `disabledFocusable` Button**: activating it neither calls the Toast's `onDismiss` nor dismisses the toast (the Button prevents activation before the composed handler) → Task T4.
5. **The focus shortcut pressed while the newest toast is exiting, or while every toast is dismissed**: it focuses the newest toast that is not dismissed, or does nothing and leaves the key press to the page (no `preventDefault`) → Task T11.

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `src/components/feedback/Toast.tsx` (modify) | The compound `Toast = Object.assign(ToastRoot, { Title, Body, Footer, Close })`, its component docblock, the flat names and the re-exports the barrel needs | T1, T2, T4, T7, T11 |
| `src/components/feedback/Toast.root.tsx` (create) | `ToastRoot` (displayName `'Toast'`), `ToastProps`: icon, severity text, the part scan and 0.5 form, the Dismiss button, the standalone context, the registration inside a container | T1, T2, T3, T5 |
| `src/components/feedback/Toast.parts.tsx` (create) | `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose` and their props types | T2, T4 |
| `src/components/feedback/Toast.context.ts` (create) | `ToasterContext` (controller), `ToastContext` (per toast) with its registration types, `ToastUnscannedContext`, `useToastContext` | T1, T2, T5 |
| `src/components/feedback/Toaster.tsx` (create) | Types (`ToastOptions`, `ToastDispatchOptions`, `ToastController`, `ToastPosition`, `ToasterShortcuts`, `ToasterProps`), `useToastController`, entries and queue, timers, the `ToastContainer`, announcements, keyboard, the handle binding, `Toaster` | T1, T5–T14 |
| `src/lib/toaster.ts` (create) | `isToastOptions`, `ToasterHandle`, `createToaster`, internal `bindToasterHandle` | T7, T14 |
| `src/components/feedback/__tests__/toasterHarness.tsx` (create) | Test harness: `ControllerProbe`, `renderToaster`, `getViewport`, `getToasts`, `getLiveRegion`, `advance` | T5, T7 |
| `src/components/feedback/__tests__/Toast.parts.test.tsx` (create) | Parts, icon, `Toast.Close`, the container, presence | T2–T6 |
| `src/components/feedback/__tests__/Toaster.content.test.tsx` (create) | Content dispatch, action timeout, severity, announcements | T7–T10 |
| `src/components/feedback/__tests__/Toaster.keyboard.test.tsx` (create) | Shortcut, Escape, Delete/Backspace, region-wide pausing | T11–T13 |
| `src/components/feedback/__tests__/Toaster.handle.test.tsx` (create) | The handle with React | T14 |
| `src/lib/__tests__/toaster.test.ts` (create) | `isToastOptions`, the handle without React (jsdom) | T7, T14 |
| `src/lib/__tests__/toaster.server.test.tsx` (create) | The handle on the server (`// @vitest-environment node`) | T14 |
| `src/components/feedback/__tests__/Toast.test.tsx` (modify) | The §6.4 updates only: `bodyAfter`, the container role, region-wide pausing | T2, T5, T13 |
| `stories/Toast.stories.tsx` (modify) | `Parts`, `TitleAction`, `CustomIcon`, `Standalone`, `RichContent`, `CustomContent`, `ProgressToast`, `KeyboardShortcut`, `FromOutsideReact` | T15 |

Two files beyond the spec's §3 list: `__tests__/toasterHarness.tsx` (shared test helpers, as `navigation/__tests__/menuHarness.tsx`) and `src/lib/__tests__/toaster.server.test.tsx` (the spec's node-environment test needs a file of its own: the jsdom file needs `window` for the queue).

Wave A has already added `toastClassNames.root`, `.icon`, `.content`, `.dismissButton` and `toasterClassNames.root` as the first `cn()` argument of the 0.7 elements (Task A6); the snippets below show them where they are.

---

### Task T1: Split `Toast.tsx` into root, context and Toaster modules (no behaviour change)

**Files:**
- Create: `src/components/feedback/Toast.context.ts`, `src/components/feedback/Toast.root.tsx`, `src/components/feedback/Toaster.tsx`
- Modify: `src/components/feedback/Toast.tsx` (becomes a re-export module)
- Test: `src/components/feedback/__tests__/Toast.test.tsx` (unchanged: it is the safety net of this refactor)

**Interfaces:**
- Consumes: `toastClassNames` (`root`, `icon`, `content`, `dismissButton`) and `toasterClassNames.root` from `src/lib/classNames.ts`, already in the 0.7 code since Task A6.
- Produces: `Toast.context.ts` exports `ToasterContext: React.Context<ToastController | null>` and `ToasterRegionContext: React.Context<boolean>` (removed again in T5). `Toast.root.tsx` exports `ToastProps` and `Toast` (the 0.7 component with its docblock). `Toaster.tsx` exports `ToastOptions`, `ToastController`, `ToastPosition`, `ToasterProps`, `useToastController`, `Toaster`. `Toast.tsx` re-exports exactly what the barrel imports.

- [ ] **Step 1: Confirm the baseline**

Run: `npx vitest run src/components/feedback/__tests__/Toast.test.tsx`
Expected: PASS (every test).

- [ ] **Step 2: Create `src/components/feedback/Toast.context.ts`**

```ts
import * as React from 'react';
import type { ToastController } from './Toaster';

/** The controller of the enclosing Toaster (`useToastController`); `null` outside one. */
export const ToasterContext = React.createContext<ToastController | null>(null);
ToasterContext.displayName = 'ToasterContext';

/**
 * `true` for the toasts the Toaster renders in its region, which its live regions announce. A
 * Toast rendered anywhere else (also as app content inside `<Toaster>`) is a live region itself.
 */
export const ToasterRegionContext = React.createContext(false);
ToasterRegionContext.displayName = 'ToasterRegionContext';
```

- [ ] **Step 3: Create `src/components/feedback/Toast.root.tsx`**

Start the file with this import block, then move `ToastProps` and `Toast` (its docblock, the component and `Toast.displayName = 'Toast'`) from `Toast.tsx` unchanged:

```ts
import * as React from 'react';
import { cn } from '../../lib/cn';
import { toastClassNames } from '../../lib/classNames';
import { DismissIcon } from '../../lib/icons';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import type { Status } from '../../lib/types';
import {
  STATUS_BORDER,
  STATUS_ICON_COLOR,
  StatusIcon,
  StatusText,
  getStatusLabel,
} from './MessageBar.status';
import { ToasterRegionContext } from './Toast.context';
```

- [ ] **Step 4: Create `src/components/feedback/Toaster.tsx`**

Start the file with this import block, then move from `Toast.tsx`, unchanged and in this order: `ToastOptions`, `ToastController`, `ToastEntry`, `promoteQueued`, `resolveLimit`, `INERT_CONTROLLER`, `MISSING_TOASTER_MESSAGE`, `useToastController` (with its docblock), `DEFAULT_TIMEOUT`, `PauseReason`, `RunningTimer`, `ToastTimers`, `createToastTimers`, `ToastPosition`, `ToasterProps`, `positionClasses`, `EDGE_GAP`, `isOnRightSide`, `getSidePanelOffset`, `getAnnouncement`, `ANNOUNCEMENT_DURATION`, `LiveMessage`, `ToasterItemProps`, `ToasterItem`, `Toaster` (with its docblock and `Toaster.displayName`):

```ts
import * as React from 'react';
import { cn } from '../../lib/cn';
import { toasterClassNames } from '../../lib/classNames';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { getDirection } from '../../lib/direction';
import { getFirstTabbable } from '../../lib/focus';
import { getOpenLayers, subscribeLayers } from '../../lib/layers';
import type { Status } from '../../lib/types';
import { useDirection } from '../../hooks/useDirection';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePreserveFocus } from '../../hooks/usePreserveFocus';
import { Portal } from '../portal/Portal';
import { getStatusLabel } from './MessageBar.status';
import { ToasterContext, ToasterRegionContext } from './Toast.context';
import { Toast } from './Toast.root';
```

`ToasterItem` keeps rendering `<Toast …>`, now imported from `./Toast.root`. `ToastEntry`, `promoteQueued`, `createToastTimers` and the other helpers stay module-private (no `export`).

- [ ] **Step 5: Replace the content of `src/components/feedback/Toast.tsx`**

```ts
export { Toast } from './Toast.root';
export type { ToastProps } from './Toast.root';
export { Toaster, useToastController } from './Toaster';
export type { ToasterProps, ToastOptions, ToastController, ToastPosition } from './Toaster';
```

`Toast.parts.tsx` is created by Task T2 with the first parts (0.7 has no part to move).

- [ ] **Step 6: Run the tests and quick checks**

Run: `npx vitest run src/components/feedback/__tests__/Toast.test.tsx src/__tests__/integration.test.tsx`
Expected: PASS (the barrel still resolves every name; `integration.test.tsx` keeps its toast cases).

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit`
Expected: no errors (the library program includes `src/components/feedback/index.ts`, so a broken re-export shows).

Run: `npx eslint src/components/feedback/Toast.tsx src/components/feedback/Toast.root.tsx src/components/feedback/Toast.context.ts src/components/feedback/Toaster.tsx --max-warnings 0`
Expected: no output.

Run: `npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/Toast"`
Expected: PASS for `Toast.tsx`, `Toast.root.tsx`, `Toast.context.ts` and `Toaster.tsx` (the `class-names` rule finds `toastClassNames.root` in `Toast.root.tsx` and `toasterClassNames.root` in `Toaster.tsx`).

Run: `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Feedback/Toast"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/feedback/Toast.tsx src/components/feedback/Toast.root.tsx src/components/feedback/Toast.context.ts src/components/feedback/Toaster.tsx
git commit -m "refactor(feedback): split Toast.tsx into root, context and Toaster modules"
```

---

### Task T2: Toast parts and the per-toast context (`Toast.Title`, `Toast.Body`, `Toast.Footer`)

**Files:**
- Create: `src/components/feedback/Toast.parts.tsx`, `src/components/feedback/__tests__/Toast.parts.test.tsx`
- Modify: `src/components/feedback/Toast.context.ts`, `src/components/feedback/Toast.root.tsx`, `src/components/feedback/Toast.tsx`, `src/components/feedback/Toaster.tsx` (the `ToastRoot` import), `src/components/feedback/__tests__/Toast.test.tsx` (the `bodyAfter` helper, spec §6.4)

**Interfaces:**
- Consumes: `toastTitleClassNames` (`root`, `label`, `action`), `toastBodyClassNames` (`root`, `subtitle`), `toastFooterClassNames.root`, `toastClassNames.*` (`src/lib/classNames.ts`); `flattenChildren`, `isElementOfType` (`src/lib/children.ts`); `reportMissingContext`, `warnOnce` (`src/lib/dev.ts`); `renderSlot`, `slotRendersContent`, `materialiseSlotContent`, `Slot` (`src/lib/slot.ts`).
- Produces:
  - `Toast.context.ts`: `type ToastPartRegistration`, `interface ToastRegistration`, `interface ToastContextValue { titleId: string | undefined; dismiss: (() => void) | undefined; registerPart: (part: ToastPartRegistration) => () => void; registerToast: ((toast: ToastRegistration) => () => void) | null }`, `ToastContext`, `ToastUnscannedContext`, `INERT_TOAST_CONTEXT`, `useToastContext(componentName: string): ToastContextValue`.
  - `Toast.parts.tsx`: `ToastTitle` + `ToastTitleProps`, `ToastBody` + `ToastBodyProps`, `ToastFooter` + `ToastFooterProps` (displayNames `'ToastTitle'`, `'ToastBody'`, `'ToastFooter'`).
  - `Toast.root.tsx`: `ToastRoot` (displayName `'Toast'`, no docblock of its own), `ToastProps`.
  - `Toast.tsx`: `export const Toast = /* @__PURE__ */ Object.assign(ToastRoot, { Title: ToastTitle, Body: ToastBody, Footer: ToastFooter })`, the flat names and the type re-exports.

- [ ] **Step 1: Write the failing tests**

Create `src/components/feedback/__tests__/Toast.parts.test.tsx`:

```tsx
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Toast, ToastBody, ToastFooter, ToastTitle } from '../Toast';
import {
  toastBodyClassNames,
  toastClassNames,
  toastFooterClassNames,
  toastTitleClassNames,
} from '../../../lib/classNames';
import {
  asClientReference,
  expectThrows,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';

/** Renders a part inside a standalone Toast, the host its context needs. */
function ToastWrapper({ children }: { children: React.ReactNode }) {
  return <Toast>{children}</Toast>;
}

const unscanned = (part: 'Title' | 'Body' | 'Footer') =>
  `[WaveUI] Toast.${part} is not a direct child of Toast, so it renders inside the body that Toast makes for its children. Make it a direct child of Toast.`;

describe('Toast parts (P3-02, toast-2)', () => {
  describe('ToastTitle', () => {
    testSystemProps(ToastTitle, {
      expectedTag: 'div',
      displayName: 'ToastTitle',
      defaultProps: { children: 'Saved' },
      wrapper: ToastWrapper,
    });
  });

  describe('ToastBody', () => {
    testSystemProps(ToastBody, {
      expectedTag: 'div',
      displayName: 'ToastBody',
      defaultProps: { children: 'Your changes were saved.' },
      wrapper: ToastWrapper,
    });
  });

  describe('ToastFooter', () => {
    testSystemProps(ToastFooter, {
      expectedTag: 'div',
      displayName: 'ToastFooter',
      defaultProps: { children: <button type="button">Undo</button> },
      wrapper: ToastWrapper,
    });
  });

  testCompoundExposure(Toast, ['Title', 'Body', 'Footer']);

  it('exports every part under its flat name (C-COMPOUND)', () => {
    expect(ToastTitle).toBe(Toast.Title);
    expect(ToastBody).toBe(Toast.Body);
    expect(ToastFooter).toBe(Toast.Footer);
  });

  it('renders the title row, the body with its subtitle and the footer in the content column', () => {
    render(
      <Toast status="success" data-testid="toast">
        <Toast.Title action={<a href="#details">Details</a>}>Backup complete</Toast.Title>
        <Toast.Body subtitle="2 minutes ago">All files were copied.</Toast.Body>
        <Toast.Footer>
          <button type="button">Open archive</button>
        </Toast.Footer>
      </Toast>,
    );
    const content = screen.getByTestId('toast').querySelector(`.${toastClassNames.content}`);
    const label = screen.getByText('Backup complete');
    const row = label.parentElement;
    expect(label).toHaveClass(toastTitleClassNames.label);
    expect(row).toHaveClass(toastTitleClassNames.root);
    expect(screen.getByRole('link', { name: 'Details' }).parentElement).toHaveClass(
      toastTitleClassNames.action,
    );
    const body = screen.getByText('All files were copied.');
    expect(body).toHaveClass(toastBodyClassNames.root);
    expect(within(body).getByText('2 minutes ago')).toHaveClass(toastBodyClassNames.subtitle);
    const footer = screen.getByRole('button', { name: 'Open archive' }).parentElement;
    expect(footer).toHaveClass(toastFooterClassNames.root);
    // After the visually hidden severity text, in the order given.
    expect(content?.firstElementChild).toHaveTextContent('Success:');
    expect(Array.from(content?.children ?? []).slice(1)).toEqual([row, body, footer]);
  });

  it('renders no action element for an action that renders nothing, and no empty subtitle', () => {
    render(
      <Toast>
        <Toast.Title action={false}>Saved</Toast.Title>
        <Toast.Body subtitle="">Done.</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Saved').parentElement?.children).toHaveLength(1);
    expect(screen.getByText('Done.').children).toHaveLength(0);
  });

  it('renders the 0.5 title prop and plain children through the Title and Body parts', () => {
    render(<Toast title="Saved">Your changes were saved.</Toast>);
    expect(screen.getByText('Saved')).toHaveClass(toastTitleClassNames.label);
    expect(screen.getByText('Your changes were saved.')).toHaveClass(toastBodyClassNames.root);
  });

  it('renders the title prop as a Title next to Body and Footer parts', () => {
    render(
      <Toast title="Upload failed">
        <Toast.Body>The file is too large.</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Upload failed')).toHaveClass(toastTitleClassNames.label);
    expect(screen.getByText('The file is too large.')).toHaveClass(toastBodyClassNames.root);
  });

  it('finds parts inside a Fragment (no body around them, no warning)', () => {
    const warn = vi.spyOn(console, 'warn');
    render(
      <Toast>
        <>
          <Toast.Title>Saved</Toast.Title>
          <Toast.Body>Done.</Toast.Body>
        </>
      </Toast>,
    );
    expect(screen.getByText('Saved').closest(`.${toastBodyClassNames.root}`)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('finds parts written in a Server Component (client references): the same markup', () => {
    const Title = asClientReference(Toast.Title);
    const Body = asClientReference(Toast.Body);
    const Footer = asClientReference(Toast.Footer);
    const plain = renderToString(
      <Toast>
        <Toast.Title>Saved</Toast.Title>
        <Toast.Body>Done.</Toast.Body>
        <Toast.Footer>
          <button type="button">Undo</button>
        </Toast.Footer>
      </Toast>,
    );
    const lazy = renderToString(
      <Toast>
        <Title>Saved</Title>
        <Body>Done.</Body>
        <Footer>
          <button type="button">Undo</button>
        </Footer>
      </Toast>,
    );
    expect(lazy).toBe(plain);
  });

  it.each(['Title', 'Body', 'Footer'] as const)(
    'warns once when Toast.%s is not a direct child: it renders inside the body',
    (part) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function AppPart() {
        if (part === 'Title') return <Toast.Title>Saved</Toast.Title>;
        if (part === 'Body') return <Toast.Body>Saved</Toast.Body>;
        return (
          <Toast.Footer>
            <button type="button">Saved</button>
          </Toast.Footer>
        );
      }
      render(
        <Toast>
          <AppPart />
        </Toast>,
      );
      // The part's element sits inside the body the Toast made for its children.
      const element = screen.getByText('Saved');
      expect(element.parentElement?.closest(`.${toastBodyClassNames.root}`)).not.toBeNull();
      expect(warn.mock.calls).toEqual([[unscanned(part)]]);
      warn.mockRestore();
    },
  );

  it('prefers a Toast.Title part over the title prop, with a development warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Toast title="Prop title">
        <Toast.Title>Part title</Toast.Title>
      </Toast>,
    );
    expect(screen.queryByText('Prop title')).not.toBeInTheDocument();
    expect(screen.getByText('Part title')).toHaveClass(toastTitleClassNames.label);
    expect(warn.mock.calls).toEqual([
      ['[WaveUI] Toast: `title` is ignored because a Toast.Title is among the children. Remove one of them.'],
    ]);
    warn.mockRestore();
  });

  it.each([
    ['Toast.Title', <Toast.Title key="title">Saved</Toast.Title>],
    ['Toast.Body', <Toast.Body key="body">Done.</Toast.Body>],
    ['Toast.Footer', <Toast.Footer key="footer" />],
  ])('%s throws outside a Toast (C-CONTEXT)', (name, ui) => {
    expectThrows(ui, `[WaveUI] ${name} must be used within <Toast>`);
  });

  it('uses a consumer id on Toast.Body, and a generated one otherwise', () => {
    const { unmount } = render(
      <Toast>
        <Toast.Body id="save-details">Saved to Documents.</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Saved to Documents.')).toHaveAttribute('id', 'save-details');
    unmount();
    render(
      <Toast>
        <Toast.Body>Saved to Documents.</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Saved to Documents.').id).not.toBe('');
  });

  it('renders its parts on the server and hydrates without warnings', async () => {
    const ui = (
      <Toast status="success">
        <Toast.Title>Saved</Toast.Title>
        <Toast.Body>Your changes were saved.</Toast.Body>
      </Toast>
    );
    const host = document.createElement('div');
    host.innerHTML = renderToString(ui);
    document.body.append(host);
    const error = vi.spyOn(console, 'error');
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(host, ui);
      });
      expect(error).not.toHaveBeenCalled();
      expect(within(host).getByText('Saved')).toHaveClass(toastTitleClassNames.label);
    } finally {
      act(() => root?.unmount());
      error.mockRestore();
      host.remove();
    }
  });
});
```

`getByText('Saved')` finds the label span (Title), the part's own body (Body) or the button (Footer); its parent element's nearest body is the one Toast generated in each case.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/Toast.parts.test.tsx`
Expected: FAIL — `ToastTitle` is not exported by `../Toast` (and `Toast.Title` is `undefined`).

- [ ] **Step 3: Add the per-toast context to `src/components/feedback/Toast.context.ts`**

Replace the file's content (T1's two contexts stay; `ToasterRegionContext` goes in T5):

```ts
import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';
import type { Status } from '../../lib/types';
import type { ToastController } from './Toaster';

/** The controller of the enclosing Toaster (`useToastController`); `null` outside one. */
export const ToasterContext = React.createContext<ToastController | null>(null);
ToasterContext.displayName = 'ToasterContext';

/**
 * `true` for the toasts the Toaster renders in its region, which its live regions announce. A
 * Toast rendered anywhere else (also as app content inside `<Toaster>`) is a live region itself.
 */
export const ToasterRegionContext = React.createContext(false);
ToasterRegionContext.displayName = 'ToasterRegionContext';

/**
 * A part registered with its toast (D9, D10): the title (its label names the toast), the body (it
 * describes the toast) or the footer (its controls are actions). The getters are read when the
 * container composes its name, timer and announcement, after the parts have mounted.
 */
export type ToastPartRegistration =
  | {
      kind: 'title';
      id: string;
      getLabel: () => HTMLElement | null;
      getRow: () => HTMLElement | null;
    }
  | { kind: 'body'; id: string; getElement: () => HTMLElement | null }
  | { kind: 'footer'; getElement: () => HTMLElement | null };

/** What a Toast rendered inside the Toaster's container registers with it (D10–D12). */
export interface ToastRegistration {
  status: Status;
  /** The resolved severity text (`''` when hidden). */
  statusLabel: string;
  /** The id of the visually hidden severity text, while it renders. */
  statusTextId: string | undefined;
  /** The Toast's `onDismiss`, called before the container dismisses the toast. */
  onDismiss: (() => void) | undefined;
  /** The Toast's built-in Dismiss button, which is no action. */
  getDismissButton: () => HTMLElement | null;
}

/** One per toast: provided by a standalone Toast and by the Toaster's container (D9). */
export interface ToastContextValue {
  /** The id of the title text that names the toast (`Toast.Title`'s label). */
  titleId: string | undefined;
  /**
   * What `Toast.Close` and the Dismiss button call: the Toast's `onDismiss` (when there is one),
   * then, inside the Toaster, the toast's dismissal. `undefined` when there is nothing to call.
   */
  dismiss: (() => void) | undefined;
  /** Registers a part (a no-op in a standalone Toast); returns the unregister function. */
  registerPart: (part: ToastPartRegistration) => () => void;
  /** Registers the Toast rendered inside a Toaster container; `null` everywhere else. */
  registerToast: ((toast: ToastRegistration) => () => void) | null;
}

export const ToastContext = React.createContext<ToastContextValue | null>(null);
ToastContext.displayName = 'ToastContext';

/** `true` inside the body a Toast wraps around children in which its scan found no part (D15 rule). */
export const ToastUnscannedContext = React.createContext(false);
ToastUnscannedContext.displayName = 'ToastUnscannedContext';

const unregisterNothing = () => {};

/** The context a part gets in production outside a Toast (C-CONTEXT). */
export const INERT_TOAST_CONTEXT: ToastContextValue = {
  titleId: undefined,
  dismiss: undefined,
  registerPart: () => unregisterNothing,
  registerToast: null,
};

/**
 * The per-toast context of a part. Outside a Toast and a Toaster's container it throws
 * `[WaveUI] <componentName> must be used within <Toast>` in development and returns an inert
 * context in production (C-CONTEXT).
 */
export function useToastContext(componentName: string): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (context) return context;
  reportMissingContext(componentName, '<Toast>');
  return INERT_TOAST_CONTEXT;
}
```

- [ ] **Step 4: Create `src/components/feedback/Toast.parts.tsx`**

```tsx
import * as React from 'react';
import { cn } from '../../lib/cn';
import {
  toastBodyClassNames,
  toastFooterClassNames,
  toastTitleClassNames,
} from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { ToastUnscannedContext, useToastContext } from './Toast.context';

/**
 * Development warning (once, from an effect) for a part that renders inside the body a Toast made
 * for children in which its scan found no part: the part sits inside the app's own component.
 */
function useUnscannedWarning(part: 'Title' | 'Body' | 'Footer'): void {
  const unscanned = React.useContext(ToastUnscannedContext);
  React.useEffect(() => {
    if (!unscanned) return;
    warnOnce(
      `Toast.${part}:unscanned`,
      `Toast.${part} is not a direct child of Toast, so it renders inside the body that Toast makes for its children. Make it a direct child of Toast.`,
    );
  }, [unscanned, part]);
}

/** Properties for the ToastTitle sub-component. */
export interface ToastTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content at the end of the title row, such as a link or a button (often in `Toast.Close`). */
  action?: Slot<'span'>;
  /** Ref to the title row. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The title row: the title text (which names the toast) and an optional `action` at its end. A
 * direct child of Toast, or dispatched content of a Toaster.
 *
 * Also exported as `ToastTitle` (import the flat name from React Server Components).
 */
export const ToastTitle = ({ action, className, children, ref, ...rest }: ToastTitleProps) => {
  const { titleId, registerPart } = useToastContext('Toast.Title');
  useUnscannedWarning('Title');
  const rowRef = React.useRef<HTMLDivElement>(null);
  const labelRef = React.useRef<HTMLSpanElement>(null);
  const mergedRef = useMergedRefs(ref, rowRef);
  React.useLayoutEffect(() => {
    if (titleId === undefined) return undefined;
    return registerPart({
      kind: 'title',
      id: titleId,
      getLabel: () => labelRef.current,
      getRow: () => rowRef.current,
    });
  }, [registerPart, titleId]);
  return (
    <div
      ref={mergedRef}
      {...rest}
      className={cn(toastTitleClassNames.root, 'flex items-start gap-2', className)}
    >
      <span
        ref={labelRef}
        id={titleId}
        className={cn(
          toastTitleClassNames.label,
          'min-w-0 flex-1 text-body-2 font-semibold text-foreground',
        )}
      >
        {children}
      </span>
      {slotRendersContent(action)
        ? renderSlot(action, 'span', cn(toastTitleClassNames.action, 'shrink-0'))
        : null}
    </div>
  );
};
ToastTitle.displayName = 'ToastTitle';

/** Properties for the ToastBody sub-component. */
export interface ToastBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A secondary line under the body text. */
  subtitle?: React.ReactNode;
  /** Ref to the body element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The body text and an optional `subtitle`, which describe the toast. Your `id` is the id the
 * toast's description points at (a generated one otherwise).
 *
 * Also exported as `ToastBody` (import the flat name from React Server Components).
 */
export const ToastBody = ({
  subtitle,
  id: idProp,
  className,
  children,
  ref,
  ...rest
}: ToastBodyProps) => {
  const { registerPart } = useToastContext('Toast.Body');
  useUnscannedWarning('Body');
  const generatedId = useId('wave-toast-body');
  const id = idProp ?? generatedId;
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(ref, bodyRef);
  React.useLayoutEffect(
    () => registerPart({ kind: 'body', id, getElement: () => bodyRef.current }),
    [registerPart, id],
  );
  return (
    <div
      ref={mergedRef}
      {...rest}
      id={id}
      className={cn(toastBodyClassNames.root, 'mt-0.5 text-body-1 text-muted-foreground', className)}
    >
      {children}
      {slotRendersContent(subtitle) ? (
        <div className={cn(toastBodyClassNames.subtitle, 'mt-1 text-caption-1 text-muted-foreground')}>
          {materialiseSlotContent(subtitle)}
        </div>
      ) : null}
    </div>
  );
};
ToastBody.displayName = 'ToastBody';

/** Properties for the ToastFooter sub-component. */
export interface ToastFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the footer element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * A row of actions under the body.
 *
 * Also exported as `ToastFooter` (import the flat name from React Server Components).
 */
export const ToastFooter = ({ className, ref, ...rest }: ToastFooterProps) => {
  const { registerPart } = useToastContext('Toast.Footer');
  useUnscannedWarning('Footer');
  const footerRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(ref, footerRef);
  React.useLayoutEffect(
    () => registerPart({ kind: 'footer', getElement: () => footerRef.current }),
    [registerPart],
  );
  return (
    <div
      ref={mergedRef}
      {...rest}
      className={cn(toastFooterClassNames.root, 'mt-2 flex flex-wrap gap-2', className)}
    />
  );
};
ToastFooter.displayName = 'ToastFooter';
```

- [ ] **Step 5: Turn `Toast.root.tsx` into `ToastRoot` with the part scan**

Replace the whole file (the docblock moves to `Toast.tsx` in Step 6; a root in a sibling module carries none, C-DOCS):

```tsx
import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { toastClassNames } from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { DismissIcon } from '../../lib/icons';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import type { Status } from '../../lib/types';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import {
  STATUS_BORDER,
  STATUS_ICON_COLOR,
  StatusIcon,
  StatusText,
  getStatusLabel,
} from './MessageBar.status';
import { ToastContext, ToastUnscannedContext, ToasterRegionContext } from './Toast.context';
import type { ToastContextValue } from './Toast.context';
import { ToastBody, ToastFooter, ToastTitle } from './Toast.parts';

/** Properties for the Toast component. */
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Status level controlling the toast color, icon and status text.
   * @default 'info'
   */
  status?: Status;
  /**
   * Title text (the 0.5 form; renders as a `Toast.Title`). A `Toast.Title` among the children wins
   * over it (development warning).
   */
  title?: string;
  /**
   * Visually hidden status text read before the toast (`'Info:'`, `'Success:'`, `'Warning:'`,
   * `'Error:'` by default). Pass a translation for other languages, or `''` to omit it.
   */
  statusLabel?: string;
  /** Called when the dismiss button is activated. Passing it renders the dismiss button. */
  onDismiss?: () => void;
  /**
   * Accessible name of the dismiss button. Pass a translation for other languages.
   * @default 'Dismiss'
   */
  dismissLabel?: string;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

const registerNothing: ToastContextValue['registerPart'] = () => () => {};

/**
 * The content column's parts. With a `Toast.Title`, `Toast.Body` or `Toast.Footer` among the
 * direct children (Fragments and Server Component references included), the children render as
 * given, after a Title made from the `title` prop when there is no Title part. Otherwise the 0.5
 * form: the `title` prop as a Title and the children as a Body (none for content that renders
 * nothing).
 */
function renderParts(
  title: string | undefined,
  children: React.ReactNode,
): { content: React.ReactNode; titleTwice: boolean } {
  // A generator is read once here (and cached), so the scan and the render see the same items.
  const items = materialiseSlotContent(children);
  const flat = flattenChildren(items);
  if (flat.some(({ node }) => isElementOfType(node, ToastTitle, ToastBody, ToastFooter))) {
    const hasTitlePart = flat.some(({ node }) => isElementOfType(node, ToastTitle));
    return {
      content: (
        <>
          {title && !hasTitlePart ? <ToastTitle>{title}</ToastTitle> : null}
          {items}
        </>
      ),
      titleTwice: Boolean(title) && hasTitlePart,
    };
  }
  return {
    content: (
      <>
        {title ? <ToastTitle>{title}</ToastTitle> : null}
        {slotRendersContent(items) ? (
          <ToastBody>
            <ToastUnscannedContext.Provider value={true}>{items}</ToastUnscannedContext.Provider>
          </ToastBody>
        ) : null}
      </>
    ),
    titleTwice: false,
  };
}

export const ToastRoot = ({
  status = 'info',
  title,
  statusLabel,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
  children,
  ref,
  ...rest
}: ToastProps) => {
  const inToasterRegion = React.useContext(ToasterRegionContext);
  const titleId = useId('wave-toast-title');
  const handleDismiss = useEventCallback(onDismiss);
  const hasOnDismiss = onDismiss !== undefined;
  const context = React.useMemo<ToastContextValue>(
    () => ({
      titleId,
      dismiss: hasOnDismiss ? handleDismiss : undefined,
      registerPart: registerNothing,
      registerToast: null,
    }),
    [titleId, hasOnDismiss, handleDismiss],
  );
  const { content, titleTwice } = renderParts(title, children);
  React.useEffect(() => {
    if (!titleTwice) return;
    warnOnce(
      'Toast:title-twice',
      'Toast: `title` is ignored because a Toast.Title is among the children. Remove one of them.',
    );
  }, [titleTwice]);
  const liveRegion: React.HTMLAttributes<HTMLDivElement> = inToasterRegion
    ? {}
    : status === 'error'
      ? { role: 'alert', 'aria-live': 'assertive' }
      : { role: 'status', 'aria-live': 'polite' };
  return (
    <ToastContext.Provider value={context}>
      <div
        ref={ref}
        {...liveRegion}
        {...rest}
        className={cn(
          toastClassNames.root,
          'flex items-start gap-3 rounded border border-s-4 border-border bg-background p-3 text-foreground shadow-4',
          STATUS_BORDER[status],
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(toastClassNames.icon, 'mt-0.5 inline-flex shrink-0', STATUS_ICON_COLOR[status])}
        >
          <StatusIcon status={status} />
        </span>
        <div className={cn(toastClassNames.content, 'min-w-0 flex-1')}>
          <StatusText label={getStatusLabel(status, statusLabel)} />
          {content}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={() => onDismiss()}
            className={cn(
              toastClassNames.dismissButton,
              'inline-flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-muted-foreground',
              'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground',
              'not-disabled:not-aria-disabled:active:bg-subtle-pressed',
              focusRing,
            )}
            aria-label={dismissLabel}
          >
            <DismissIcon />
          </button>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
};
ToastRoot.displayName = 'Toast';
```

In `Toaster.tsx`, change the import to `import { ToastRoot } from './Toast.root';` and render `<ToastRoot …>` in `ToasterItem` (same props as before).

- [ ] **Step 6: Make `Toast.tsx` the compound module**

```tsx
import { ToastBody, ToastFooter, ToastTitle } from './Toast.parts';
import { ToastRoot } from './Toast.root';

export type { ToastProps } from './Toast.root';
export type { ToastTitleProps, ToastBodyProps, ToastFooterProps } from './Toast.parts';
export { Toaster, useToastController } from './Toaster';
export type { ToasterProps, ToastOptions, ToastController, ToastPosition } from './Toaster';

/**
 * A notification: status icon, visually hidden severity text, title, body, footer and a Dismiss
 * button. Its parts are direct children: `Toast.Title` (the title row, with an optional
 * `action`), `Toast.Body` (with an optional `subtitle`) and `Toast.Footer` (a row of actions). The
 * `title` prop and plain children are the 0.5 form and render as a Title and a Body.
 *
 * - **In a Toaster** (dispatched with `useToastController()`): not a live region itself; the
 *   Toaster announces it through its permanent live regions.
 * - **On its own** (your own container, an inline notice): a live region, as in 0.4 —
 *   `role="status"` with `aria-live="polite"`, or `role="alert"` with `aria-live="assertive"` for
 *   `error` (override with `role`/`aria-live`). A live region that is added together with its
 *   text is not announced by every screen reader, so render the Toast in advance and change its
 *   content, or dispatch it through a Toaster.
 *
 * Sub-components are also exported under flat names (`ToastTitle`, `ToastBody`, `ToastFooter`):
 * React Server Components import those, because dotted access (`Toast.Title`) needs a client file.
 */
export const Toast = /* @__PURE__ */ Object.assign(ToastRoot, {
  Title: ToastTitle,
  Body: ToastBody,
  Footer: ToastFooter,
});

export { ToastTitle, ToastBody, ToastFooter };
```

- [ ] **Step 7: Update the `bodyAfter` helper of `Toast.test.tsx` (spec §6.4)**

The title text now sits in the label span inside `Toast.Title`, so the helper steps up to the title row. Add `import { toastTitleClassNames } from '../../../lib/classNames';` to the imports and replace the helper (inside `describe('body content')`):

```tsx
    /** The element after the title row: the body, or `null` when none renders. */
    const bodyAfter = (title: string) =>
      screen.getByText(title).closest(`.${toastTitleClassNames.root}`)?.nextElementSibling ??
      null;
```

- [ ] **Step 8: Run the tests and quick checks**

Run: `npx vitest run src/components/feedback/__tests__/Toast.parts.test.tsx src/components/feedback/__tests__/Toast.test.tsx --reporter=default`
Expected: PASS, with no unasserted `[WaveUI]` line and no act() warning in the output.

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit`
Expected: no errors.

Run: `npx eslint src/components/feedback/Toast.tsx src/components/feedback/Toast.root.tsx src/components/feedback/Toast.parts.tsx src/components/feedback/Toast.context.ts src/components/feedback/Toaster.tsx src/components/feedback/__tests__/Toast.parts.test.tsx src/components/feedback/__tests__/Toast.test.tsx --max-warnings 0`
Expected: no output.

Run: `npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/Toast" && npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Feedback/Toast"`
Expected: PASS (the gate finds `toastTitleClassNames.root`, `toastBodyClassNames.root` and `toastFooterClassNames.root` in `Toast.parts.tsx`).

- [ ] **Step 9: Commit**

```bash
git add src/components/feedback/Toast.tsx src/components/feedback/Toast.root.tsx src/components/feedback/Toast.parts.tsx src/components/feedback/Toast.context.ts src/components/feedback/Toaster.tsx src/components/feedback/__tests__/Toast.parts.test.tsx src/components/feedback/__tests__/Toast.test.tsx
git commit -m "feat(feedback): Toast.Title, Toast.Body and Toast.Footer parts with a per-toast context"
```

---

### Task T3: The `icon` slot of `Toast` (status-icon rule)

**Files:**
- Modify: `src/components/feedback/Toast.root.tsx`
- Test: `src/components/feedback/__tests__/Toast.parts.test.tsx`

**Interfaces:**
- Consumes: `renderSlot`, `slotRendersContent`, `Slot` (`src/lib/slot.ts`); `toastClassNames.icon`.
- Produces: `ToastProps['icon']: Slot<'span'> | undefined` (spec §4.5).

- [ ] **Step 1: Write the failing tests**

Add `expectTypeOf` to the `vitest` import, `import type { ToastProps } from '../Toast';` and `import type { Slot } from '../../../lib/slot';`, then append:

```tsx
describe('icon (P3-02, toast-3)', () => {
  it('renders the status icon by default', () => {
    render(<Toast status="warning" title="Disk almost full" data-testid="toast" />);
    const icon = screen.getByTestId('toast').querySelector(`.${toastClassNames.icon}`);
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon?.querySelector('[data-wave-icon="warning"]')).not.toBeNull();
  });

  it('replaces the status icon with the icon slot, decoratively', () => {
    render(<Toast title="Synced" icon={<svg data-testid="sync" />} data-testid="toast" />);
    const icon = screen.getByTestId('sync').parentElement;
    expect(icon).toHaveClass(toastClassNames.icon);
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('toast').querySelector('[data-wave-icon]')).toBeNull();
  });

  it('keeps the icon class on a slot object that swaps the element', () => {
    render(<Toast title="Starred" icon={{ as: 'i', children: '★' }} data-testid="toast" />);
    const icon = screen.getByTestId('toast').querySelector('i');
    expect(icon).toHaveClass(toastClassNames.icon);
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([
    ['null', null],
    ['false', false],
    ["''", ''],
  ])('shows no icon for %s (anything that renders nothing)', (_, icon) => {
    render(<Toast title="Plain" icon={icon} data-testid="toast" />);
    const toast = screen.getByTestId('toast');
    expect(toast.querySelector(`.${toastClassNames.icon}`)).toBeNull();
    expect(toast.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('types icon as a span slot', () => {
    expectTypeOf<ToastProps['icon']>().toEqualTypeOf<Slot<'span'> | undefined>();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/Toast.parts.test.tsx -t "icon"`
Expected: FAIL — the custom icon is not rendered (and `tsc -p tsconfig.dev.json` reports that `icon` does not exist on `ToastProps`).

- [ ] **Step 3: Implement `icon`**

In `Toast.root.tsx`, change the slot import to `import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';`, add `import type { Slot } from '../../lib/slot';`, add to `ToastProps` after `statusLabel`:

```ts
  /**
   * Replaces the status icon (decorative, `aria-hidden`). Only `undefined` keeps the default;
   * `null`, or anything that renders nothing, shows no icon (the status-icon slot rule, as
   * `MessageBar.icon`). Fluent's `ToastTitle` `media`.
   */
  icon?: Slot<'span'>;
```

destructure `icon` in `ToastRoot`'s parameters (after `statusLabel`), and replace the icon `<span>` in the JSX with `{renderedIcon}`, computed before the `return`:

```tsx
  // The status icon: only `undefined` keeps the default; `null`, or anything that renders
  // nothing, shows none (C-SLOTS status-icon rule). The class rides in the slot's base classes,
  // so a slot object that swaps the element keeps it.
  const iconClassName = cn(toastClassNames.icon, 'mt-0.5 inline-flex shrink-0', STATUS_ICON_COLOR[status]);
  const renderedIcon =
    icon === undefined ? (
      <span aria-hidden="true" className={iconClassName}>
        <StatusIcon status={status} />
      </span>
    ) : slotRendersContent(icon) ? (
      renderSlot(icon, 'span', iconClassName, { 'aria-hidden': true })
    ) : null;
```

- [ ] **Step 4: Run the tests and quick checks**

Run: `npx vitest run src/components/feedback/__tests__/Toast.parts.test.tsx src/components/feedback/__tests__/Toast.test.tsx`
Expected: PASS.

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/feedback/Toast.root.tsx src/components/feedback/__tests__/Toast.parts.test.tsx --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/Toast.root.tsx"`
Expected: no errors; PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/feedback/Toast.root.tsx src/components/feedback/__tests__/Toast.parts.test.tsx
git commit -m "feat(feedback): icon slot on Toast"
```

---

### Task T4: `Toast.Close`

**Files:**
- Modify: `src/components/feedback/Toast.parts.tsx`, `src/components/feedback/Toast.tsx`
- Test: `src/components/feedback/__tests__/Toast.parts.test.tsx`

**Interfaces:**
- Consumes: `useToastContext` (T2); `useTriggerElement` (`src/hooks/useTriggerElement.tsx`), `mergeProps` (`src/lib/mergeProps.ts`), `useMergedRefs`, `warnOnce`.
- Produces: `ToastClose` (displayName `'ToastClose'`), `ToastCloseProps`, `ToastCloseRenderProps` (as `DialogCloseProps`/`DialogCloseRenderProps`); `Toast.Close`. Inside the Toaster (T5, T7) the same part dismisses the toast through the container's `dismiss`.

- [ ] **Step 1: Write the failing tests**

Add `import userEvent from '@testing-library/user-event';`, `import { Button } from '../../button/Button';` and `ToastClose` to the `../Toast` import; change `testCompoundExposure(Toast, ['Title', 'Body', 'Footer'])` to `testCompoundExposure(Toast, ['Title', 'Body', 'Footer', 'Close'])` and add `expect(ToastClose).toBe(Toast.Close);` to the flat-name test. Append:

```tsx
describe('Toast.Close (P3-02, toasttrigger-1)', () => {
  it('makes its child call the Toast’s onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Toast onDismiss={onDismiss}>
        <Toast.Title
          action={
            <Toast.Close>
              <button type="button">Got it</button>
            </Toast.Close>
          }
        >
          Saved
        </Toast.Title>
      </Toast>,
    );
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('runs the child’s onClick first; preventDefault() there keeps the toast', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const calls: string[] = [];
    render(
      <Toast onDismiss={onDismiss}>
        <Toast.Footer>
          <Toast.Close>
            <button type="button" onClick={() => calls.push('child')}>
              Undo
            </button>
          </Toast.Close>
          <Toast.Close>
            <button type="button" onClick={(event) => event.preventDefault()}>
              Keep
            </button>
          </Toast.Close>
        </Toast.Footer>
      </Toast>,
    );
    onDismiss.mockImplementation(() => calls.push('dismiss'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(calls).toEqual(['child', 'dismiss']);
    await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('unwraps a Fragment around a single child', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Toast onDismiss={onDismiss}>
        <Toast.Footer>
          <Toast.Close>
            <>
              <button type="button">Close</button>
            </>
          </Toast.Close>
        </Toast.Footer>
      </Toast>,
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('passes its props to a render-prop child', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Toast onDismiss={onDismiss}>
        <Toast.Footer>
          <Toast.Close>
            {(props) => (
              <button type="button" {...props}>
                Done
              </button>
            )}
          </Toast.Close>
        </Toast.Footer>
      </Toast>,
    );
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss through a disabledFocusable Button', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Toast onDismiss={onDismiss}>
        <Toast.Footer>
          <Toast.Close>
            <Button disabledFocusable>Undo</Button>
          </Toast.Close>
        </Toast.Footer>
      </Toast>,
    );
    const undo = screen.getByRole('button', { name: 'Undo' });
    await user.click(undo);
    act(() => undo.focus());
    await user.keyboard('{Enter}');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('warns once when there is nothing to dismiss', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Toast>
        <Toast.Footer>
          <Toast.Close>
            <button type="button">Close</button>
          </Toast.Close>
        </Toast.Footer>
      </Toast>,
    );
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Toast.Close has nothing to dismiss: render it in a toast dispatched to a Toaster, or in a Toast with `onDismiss`.',
      ],
    ]);
    warn.mockRestore();
  });

  it('throws outside a Toast (C-CONTEXT)', () => {
    expectThrows(
      <Toast.Close>
        <button type="button">Close</button>
      </Toast.Close>,
      '[WaveUI] Toast.Close must be used within <Toast>',
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/Toast.parts.test.tsx -t "Toast.Close|compound|flat name"`
Expected: FAIL — `ToastClose` is not exported and `Toast.Close` is not a component.

- [ ] **Step 3: Implement `ToastClose` in `Toast.parts.tsx`**

Add to the imports `import { mergeProps } from '../../lib/mergeProps';` and `import { useTriggerElement } from '../../hooks/useTriggerElement';`, then append:

```tsx
/** Props a `Toast.Close` puts on its element (and passes to a render-prop child), as `DialogCloseRenderProps`. */
export interface ToastCloseRenderProps extends React.HTMLAttributes<HTMLElement> {
  onClick: React.MouseEventHandler<HTMLElement>;
  /** A callback ref, so the props spread onto any element type. */
  ref: React.RefCallback<HTMLElement>;
}

/** Properties for the ToastClose sub-component (as `DialogCloseProps`). */
export interface ToastCloseProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** The element that dismisses the toast; a single element gets a composed `onClick`, a function the props. */
  children: React.ReactNode | ((props: ToastCloseRenderProps) => React.ReactNode);
  /** `false` renders a wrapper `<span>` that dismisses on click. @default true */
  asChild?: boolean;
  /** Ref to the close element (the child, or the wrapper span). */
  ref?: React.Ref<HTMLElement>;
}

/**
 * Makes its single child dismiss the toast: it calls the Toast's `onDismiss` (when there is one),
 * then, inside the Toaster, dismisses the toast. Your `onClick` runs first; `preventDefault()`
 * keeps the toast. Works in dispatched content with or without a `Toast`. Fluent's `ToastTrigger`.
 *
 * Also exported as `ToastClose` (import the flat name from React Server Components).
 */
export const ToastClose = ({ children, asChild, ref, ...rest }: ToastCloseProps) => {
  const { dismiss } = useToastContext('Toast.Close');
  const mergedRef = useMergedRefs<HTMLElement>(ref);
  const hasDismiss = dismiss !== undefined;
  React.useEffect(() => {
    if (hasDismiss) return;
    warnOnce(
      'Toast.Close:no-dismiss',
      'Toast.Close has nothing to dismiss: render it in a toast dispatched to a Toaster, or in a Toast with `onDismiss`.',
    );
  }, [hasDismiss]);
  const close = React.useCallback(() => {
    dismiss?.();
  }, [dismiss]);
  const closeProps = mergeProps({ onClick: close, ref: mergedRef }, rest);
  return useTriggerElement(children, closeProps as ToastCloseRenderProps, {
    componentName: 'Toast.Close',
    asChild,
  });
};
ToastClose.displayName = 'ToastClose';
```

- [ ] **Step 4: Attach the member in `Toast.tsx`**

Import `ToastClose`, add `Close: ToastClose` to the `Object.assign` members, add `ToastClose` to the flat `export { … }`, add `ToastCloseProps, ToastCloseRenderProps` to the `./Toast.parts` type re-export, and in the docblock change the parts sentence and the flat-name paragraph to:

```tsx
 * button. Its parts are direct children: `Toast.Title` (the title row, with an optional
 * `action`), `Toast.Body` (with an optional `subtitle`) and `Toast.Footer` (a row of actions); a
 * `Toast.Close` anywhere inside makes its child dismiss the toast. The `title` prop and plain
 * children are the 0.5 form and render as a Title and a Body.
 …
 * Sub-components are also exported under flat names (`ToastTitle`, `ToastBody`, `ToastFooter`,
 * `ToastClose`): React Server Components import those, because dotted access (`Toast.Title`)
 * needs a client file.
```

- [ ] **Step 5: Run the tests and quick checks**

Run: `npx vitest run src/components/feedback/__tests__/Toast.parts.test.tsx --reporter=default`
Expected: PASS; the only `[WaveUI]` output is none (the warning test silences and asserts its call).

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/feedback/Toast.parts.tsx src/components/feedback/Toast.tsx src/components/feedback/__tests__/Toast.parts.test.tsx --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/Toast"`
Expected: no errors; PASS (`ToastClose` maps to no registry constant, so the `class-names` rule skips it).

- [ ] **Step 6: Commit**

```bash
git add src/components/feedback/Toast.parts.tsx src/components/feedback/Toast.tsx src/components/feedback/__tests__/Toast.parts.test.tsx
git commit -m "feat(feedback): Toast.Close"
```

---
### Task T5: The toast container (`role="group"`, name, description, Dismiss button)

**Files:**
- Create: `src/components/feedback/__tests__/toasterHarness.tsx`
- Modify: `src/components/feedback/Toaster.tsx`, `src/components/feedback/Toast.root.tsx`, `src/components/feedback/Toast.context.ts` (remove `ToasterRegionContext`), `src/components/feedback/Toast.tsx` (docblock bullet), `src/components/feedback/__tests__/Toast.test.tsx` (the role assertion at `:537-538` and the `getToasts` comment, spec §6.4)
- Test: `src/components/feedback/__tests__/Toast.parts.test.tsx`

**Interfaces:**
- Consumes: `ToastContext`, `ToastContextValue`, `ToastPartRegistration`, `ToastRegistration` (T2); `StatusText({ label, id })` (Task A3); `toasterClassNames.toast`; `joinIds` (`src/lib/aria.ts`), `focusRing`, `useEventCallback`.
- Produces:
  - `ToastContainer` (internal to `Toaster.tsx`, displayName `'ToastContainer'`): props `{ entry: ToastEntry; index: number; timers: ToastTimers; onDismiss: (id: string) => void; getFocusFallback: (index: number) => HTMLElement | null }` (T6 changes the last two).
  - `ToastRoot` inside a container: registers `{ status, statusLabel, statusTextId, onDismiss, getDismissButton }` through `registerToast` and provides no context of its own; the Dismiss button calls the context's `dismiss`.
  - Harness `toasterHarness.tsx`: `ControllerProbe`, `renderToaster(props?, { app? })` → `{ …render result, controller(), dispatch(options): string, dismiss(id), dismissAll(), setProps(props) }`, `getViewport()`, `getToasts()`, `getLiveRegion('polite' | 'assertive')`, `advance(ms)`.

- [ ] **Step 1: Create the test harness `src/components/feedback/__tests__/toasterHarness.tsx`**

```tsx
/**
 * Test harness of the Toaster suites (P3-toasts): renders a Toaster with a controller probe and
 * returns helpers that dispatch, dismiss and query the toasts. Not a test file itself.
 */
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Toaster, useToastController } from '../Toast';
import type { ToastController, ToastOptions, ToasterProps } from '../Toast';

/** Exposes the controller of the enclosing Toaster to the test. */
export function ControllerProbe({ ref }: { ref: React.Ref<ToastController> }) {
  const controller = useToastController();
  React.useImperativeHandle(ref, () => controller, [controller]);
  return null;
}

export function renderToaster(
  props: Partial<ToasterProps> = {},
  options: { app?: React.ReactNode } = {},
) {
  const controllerRef = React.createRef<ToastController>();
  const ui = (toasterProps: Partial<ToasterProps>) => (
    <Toaster {...toasterProps}>
      <ControllerProbe ref={controllerRef} />
      {options.app}
    </Toaster>
  );
  const utils = render(ui(props));
  const controller = (): ToastController => {
    if (!controllerRef.current) throw new Error('the Toaster controller is not available');
    return controllerRef.current;
  };
  const dispatch = (toast: ToastOptions): string => {
    let id = '';
    act(() => {
      id = controller().dispatchToast(toast);
    });
    return id;
  };
  const dismiss = (id: string) => {
    act(() => controller().dismissToast(id));
  };
  const dismissAll = () => {
    act(() => controller().dismissAllToasts());
  };
  /** Re-renders the Toaster with new props (the same app content). */
  const setProps = (next: Partial<ToasterProps>) => utils.rerender(ui(next));
  return { ...utils, controller, dispatch, dismiss, dismissAll, setProps };
}

export const getViewport = () => screen.getByRole('region', { name: 'Notifications' });

export function getLiveRegion(politeness: 'polite' | 'assertive'): HTMLElement {
  const region = getViewport().querySelector<HTMLElement>(`[aria-live="${politeness}"]`);
  if (!region) throw new Error(`no ${politeness} live region`);
  return region;
}

/** The toast containers of the Toaster (one per toast), in order. */
export const getToasts = () =>
  Array.from(getViewport().querySelectorAll<HTMLElement>('[data-wave-toast]'));

/** Advances the fake timers inside `act`. */
export const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
```

- [ ] **Step 2: Write the failing tests**

In `Toast.parts.test.tsx`, add to the imports `import { Toaster } from '../Toast';`, `import type { ToastController } from '../Toast';`, `toasterClassNames` to the `classNames` import, `expectNoA11yViolations` and `findDanglingIdRefs` to the `test-utils` import, and `import { ControllerProbe, getToasts, renderToaster } from './toasterHarness';`. Append:

```tsx
describe('the toast container (P3-02, D10)', () => {
  it('wraps every toast in a focusable group named by its severity and title, described by its body', () => {
    const { dispatch } = renderToaster();
    dispatch({ status: 'error', title: 'Upload failed', body: 'The file is too large.', timeout: 0 });
    const [container] = getToasts();
    expect(container).toHaveAttribute('role', 'group');
    expect(container).toHaveAttribute('tabindex', '-1');
    expect(container).toHaveClass(toasterClassNames.toast);
    expect(screen.getByRole('group', { name: 'Error: Upload failed' })).toBe(container);
    expect(container).toHaveAccessibleDescription('The file is too large.');
    // The marker moved from the Toast to its container.
    expect(container.querySelector('[data-wave-toast]')).toBeNull();
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('names the group by the severity alone without a title, by the title alone without a severity text', () => {
    const { dispatch } = renderToaster();
    dispatch({ status: 'warning', title: '', body: 'Check your connection.', timeout: 0 });
    dispatch({ statusLabel: '', title: 'Saved', timeout: 0 });
    dispatch({ statusLabel: '', title: '', body: 'Plain', timeout: 0 });
    const [severityOnly, titleOnly, unnamed] = getToasts();
    expect(severityOnly).toHaveAccessibleName('Warning:');
    expect(titleOnly).toHaveAccessibleName('Saved');
    expect(titleOnly).not.toHaveAttribute('aria-describedby');
    expect(unnamed).not.toHaveAttribute('aria-labelledby');
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('shows the Dismiss button of every Toast and dismisses the toast with it', async () => {
    const user = userEvent.setup();
    const { dispatch } = renderToaster();
    dispatch({ title: 'Saved', timeout: 0 });
    await user.click(within(getToasts()[0]).getByRole('button', { name: 'Dismiss' }));
    expect(getToasts()).toHaveLength(0);
  });

  it('keeps one registration per part under StrictMode', () => {
    const controllerRef = React.createRef<ToastController>();
    render(
      <React.StrictMode>
        <Toaster>
          <ControllerProbe ref={controllerRef} />
        </Toaster>
      </React.StrictMode>,
    );
    const dispatchSave = (body: string | undefined) =>
      act(() => {
        controllerRef.current?.dispatchToast({ toastId: 'save', title: 'Saved', body, timeout: 0 });
      });
    dispatchSave('Your changes were saved.');
    const [container] = getToasts();
    expect(container).toHaveAccessibleName('Info: Saved');
    expect(container).toHaveAccessibleDescription('Your changes were saved.');
    // A registration left behind by StrictMode's second effect run would keep the description.
    dispatchSave(undefined);
    expect(container).not.toHaveAttribute('aria-describedby');
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('has no accessibility violations with a title and a body (open)', async () => {
    const { dispatch } = renderToaster({}, { app: <p>App content</p> });
    dispatch({ status: 'success', title: 'Saved', body: 'Your changes were saved.', timeout: 0 });
    await expectNoA11yViolations(document.body);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/Toast.parts.test.tsx -t "toast container"`
Expected: FAIL — the `[data-wave-toast]` element has no `role` (it is the Toast root, as in 0.7).

- [ ] **Step 4: Make `ToastRoot` register with a container**

In `Toast.context.ts`, delete `ToasterRegionContext` and its docblock. In `Toast.root.tsx`, change the context import to `import { ToastContext, ToastUnscannedContext } from './Toast.context';`, change the `onDismiss` JSDoc to:

```ts
  /**
   * Called when the Dismiss button or a `Toast.Close` is activated; passing it renders the button.
   * Inside the Toaster every Toast shows the button and it dismisses the toast (your `onDismiss`
   * runs first). A timeout, Escape, Delete and `dismissToast` do not call it.
   */
  onDismiss?: () => void;
```

and replace the body of `ToastRoot` (parameters unchanged, `icon` included) with:

```tsx
  // Inside the Toaster's container, whose context has `registerToast`, the Toast registers its
  // severity, `onDismiss` and Dismiss button there and its parts use that context (the container's
  // ids); everywhere else it provides its own context and is a live region (D9, D10).
  const host = React.useContext(ToastContext);
  const registerToast = host?.registerToast ?? null;
  const inToaster = registerToast !== null;
  const label = getStatusLabel(status, statusLabel);
  const statusTextId = useId('wave-toast-status');
  const titleId = useId('wave-toast-title');
  const handleDismiss = useEventCallback(onDismiss);
  const hasOnDismiss = onDismiss !== undefined;
  const dismissButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useLayoutEffect(() => {
    if (!registerToast) return undefined;
    return registerToast({
      status,
      statusLabel: label,
      statusTextId: label ? statusTextId : undefined,
      onDismiss: hasOnDismiss ? handleDismiss : undefined,
      getDismissButton: () => dismissButtonRef.current,
    });
  }, [registerToast, status, label, statusTextId, hasOnDismiss, handleDismiss]);

  const ownContext = React.useMemo<ToastContextValue>(
    () => ({
      titleId,
      dismiss: hasOnDismiss ? handleDismiss : undefined,
      registerPart: registerNothing,
      registerToast: null,
    }),
    [titleId, hasOnDismiss, handleDismiss],
  );
  // Inside the Toaster every Toast shows the Dismiss button (D11); elsewhere `onDismiss` does.
  const dismiss = inToaster ? host?.dismiss : ownContext.dismiss;

  const { content, titleTwice } = renderParts(title, children);
  React.useEffect(() => {
    if (!titleTwice) return;
    warnOnce(
      'Toast:title-twice',
      'Toast: `title` is ignored because a Toast.Title is among the children. Remove one of them.',
    );
  }, [titleTwice]);

  // The status icon: only `undefined` keeps the default; `null`, or anything that renders
  // nothing, shows none (C-SLOTS status-icon rule). The class rides in the slot's base classes,
  // so a slot object that swaps the element keeps it.
  const iconClassName = cn(toastClassNames.icon, 'mt-0.5 inline-flex shrink-0', STATUS_ICON_COLOR[status]);
  const renderedIcon =
    icon === undefined ? (
      <span aria-hidden="true" className={iconClassName}>
        <StatusIcon status={status} />
      </span>
    ) : slotRendersContent(icon) ? (
      renderSlot(icon, 'span', iconClassName, { 'aria-hidden': true })
    ) : null;

  const liveRegion: React.HTMLAttributes<HTMLDivElement> = inToaster
    ? {}
    : status === 'error'
      ? { role: 'alert', 'aria-live': 'assertive' }
      : { role: 'status', 'aria-live': 'polite' };
  const root = (
    <div
      ref={ref}
      {...liveRegion}
      {...rest}
      className={cn(
        toastClassNames.root,
        'flex items-start gap-3 rounded border border-s-4 border-border bg-background p-3 text-foreground shadow-4',
        STATUS_BORDER[status],
        className,
      )}
    >
      {renderedIcon}
      <div className={cn(toastClassNames.content, 'min-w-0 flex-1')}>
        <StatusText label={label} id={statusTextId} />
        {content}
      </div>
      {dismiss ? (
        <button
          ref={dismissButtonRef}
          type="button"
          onClick={() => dismiss()}
          className={cn(
            toastClassNames.dismissButton,
            'inline-flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-muted-foreground',
            'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground',
            'not-disabled:not-aria-disabled:active:bg-subtle-pressed',
            focusRing,
          )}
          aria-label={dismissLabel}
        >
          <DismissIcon />
        </button>
      ) : null}
    </div>
  );
  return inToaster ? root : <ToastContext.Provider value={ownContext}>{root}</ToastContext.Provider>;
```

- [ ] **Step 5: Replace `ToasterItem` with `ToastContainer` in `Toaster.tsx`**

Add to the imports `import { joinIds } from '../../lib/aria';`, `import { focusRing } from '../../lib/styles';`, `import { useEventCallback } from '../../hooks/useEventCallback';`, change the context import to

```ts
import { ToastContext, ToasterContext } from './Toast.context';
import type { ToastContextValue, ToastPartRegistration, ToastRegistration } from './Toast.context';
```

and replace `ToasterItemProps` and `ToasterItem` with:

```tsx
interface ToastContainerProps {
  entry: ToastEntry;
  index: number;
  timers: ToastTimers;
  onDismiss: (id: string) => void;
  getFocusFallback: (index: number) => HTMLElement | null;
}

function isTitlePart(
  part: ToastPartRegistration,
): part is Extract<ToastPartRegistration, { kind: 'title' }> {
  return part.kind === 'title';
}

function isBodyPart(
  part: ToastPartRegistration,
): part is Extract<ToastPartRegistration, { kind: 'body' }> {
  return part.kind === 'body';
}

/**
 * One toast of the Toaster (D10): a `role="group"` container, focusable by script (no Tab stop),
 * named by the toast's severity text and title and described by its body while a Toast inside
 * has registered them (so no id reference dangles). It provides the per-toast context, pauses the
 * timers and keeps focus when the toast goes.
 */
function ToastContainer({ entry, index, timers, onDismiss, getFocusFallback }: ToastContainerProps) {
  const { id, options } = entry;
  const containerRef = React.useRef<HTMLDivElement>(null);
  usePreserveFocus(containerRef, () => getFocusFallback(index));
  const titleId = useId('wave-toast-title');

  // The registrations of the parts and of the Toast inside, whose layout effects run before this
  // component's: in state for the name and description, in refs for reads after mount.
  const [parts, setParts] = React.useState<readonly ToastPartRegistration[]>([]);
  const partsRef = React.useRef<readonly ToastPartRegistration[]>([]);
  const registerPart = React.useCallback((part: ToastPartRegistration) => {
    partsRef.current = [...partsRef.current, part];
    setParts(partsRef.current);
    return () => {
      partsRef.current = partsRef.current.filter((item) => item !== part);
      setParts(partsRef.current);
    };
  }, []);
  const [toast, setToast] = React.useState<ToastRegistration | null>(null);
  const toastRef = React.useRef<ToastRegistration | null>(null);
  const registerToast = React.useCallback((registration: ToastRegistration) => {
    toastRef.current = registration;
    setToast(registration);
    return () => {
      if (toastRef.current !== registration) return;
      toastRef.current = null;
      setToast(null);
    };
  }, []);

  // `Toast.Close` and the Dismiss button: the Toast's `onDismiss`, then the dismissal (D9, D11).
  const dismiss = useEventCallback(() => {
    toastRef.current?.onDismiss?.();
    onDismiss(id);
  });
  const context = React.useMemo<ToastContextValue>(
    () => ({ titleId, dismiss, registerPart, registerToast }),
    [titleId, dismiss, registerPart, registerToast],
  );

  const titlePart = parts.find(isTitlePart);
  const bodyPart = parts.find(isBodyPart);
  return (
    <div
      ref={containerRef}
      role="group"
      tabIndex={-1}
      data-wave-toast=""
      aria-labelledby={joinIds(toast?.statusTextId, titlePart?.id)}
      aria-describedby={bodyPart?.id}
      className={cn(toasterClassNames.toast, 'rounded', focusRing)}
      onPointerEnter={() => timers.pause(id, 'hover')}
      onPointerLeave={() => timers.resume(id, 'hover')}
      onFocus={() => timers.pause(id, 'focus')}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        timers.resume(id, 'focus');
      }}
    >
      <ToastContext.Provider value={context}>
        <ToastRoot
          status={options.status}
          statusLabel={options.statusLabel}
          title={options.title}
          dismissLabel={options.dismissLabel}
        >
          {options.body}
        </ToastRoot>
      </ToastContext.Provider>
    </div>
  );
}
ToastContainer.displayName = 'ToastContainer';
```

In the `Toaster` JSX, remove the `ToasterRegionContext.Provider` and render the containers directly (the comment about the index stays):

```tsx
          {shownToasts.map((toast, index) => (
            <ToastContainer
              key={toast.id}
              entry={toast}
              index={index}
              timers={timers}
              onDismiss={dismissToast}
              getFocusFallback={getFocusFallback}
            />
          ))}
```

- [ ] **Step 6: Update the docblock bullet in `Toast.tsx`**

```tsx
 * - **In a Toaster** (dispatched with `useToastController()`): not a live region itself; the
 *   Toaster announces it through its permanent live regions and names its container by the
 *   severity text and title. Every Toast there shows the Dismiss button.
```

- [ ] **Step 7: Update `Toast.test.tsx` (spec §6.4)**

Add `import { toastClassNames } from '../../../lib/classNames';` (next to `toastTitleClassNames`). Replace the `getToasts` comment with `/** The toast containers of the Toaster (one per toast), in order. */`. In `'a %s toast is announced in the %s region'` replace

```tsx
    // The Toaster's toasts are not live regions themselves (feedback-navigation#11).
    const [toast] = getToasts();
    expect(toast).not.toHaveAttribute('role');
    expect(toast).not.toHaveAttribute('aria-live');
```

with

```tsx
    // The Toaster's toasts are not live regions themselves (feedback-navigation#11): each sits in
    // a named group (D10), and the Toast inside it has no live-region role either.
    const [toast] = getToasts();
    expect(toast).toHaveAttribute('role', 'group');
    expect(toast).not.toHaveAttribute('aria-live');
    const visual = toast.querySelector(`.${toastClassNames.root}`);
    expect(visual).not.toHaveAttribute('role');
    expect(visual).not.toHaveAttribute('aria-live');
```

- [ ] **Step 8: Run the tests and quick checks**

Run: `npx vitest run src/components/feedback/__tests__/Toast.parts.test.tsx src/components/feedback/__tests__/Toast.test.tsx src/__tests__/integration.test.tsx --reporter=default`
Expected: PASS. The 0.7 focus, timer (`vi.getTimerCount()`), pause, limit and side-panel tests pass unchanged: the containers are the viewport's direct children, `tabIndex={-1}` keeps the first tabbable element on the Dismiss button, and the pause handlers moved with the marker.

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/feedback --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/Toast" && npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Feedback/Toast"`
Expected: no errors; PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/feedback/Toaster.tsx src/components/feedback/Toast.root.tsx src/components/feedback/Toast.context.ts src/components/feedback/Toast.tsx src/components/feedback/__tests__/toasterHarness.tsx src/components/feedback/__tests__/Toast.parts.test.tsx src/components/feedback/__tests__/Toast.test.tsx
git commit -m "feat(feedback): a named, focusable container around every toast in the Toaster"
```

---

### Task T6: Toasts on the presence core (exit, `inert`, `limit`, focus, revival)

**Files:**
- Modify: `src/components/feedback/Toaster.tsx`
- Test: `src/components/feedback/__tests__/Toast.parts.test.tsx`

**Interfaces:**
- Consumes: `usePresence(visible, { appear, onExited })` → `{ isMounted, ref, presenceProps }` (`src/hooks/usePresence.ts`); `usePreserveFocus(ref, getFallback, { enabled })`; `mockAnimations`, `mockMatchMedia` (`src/test-utils.ts`).
- Produces: `ToastEntry.dismissed: boolean`; module helpers `markDismissed(toasts, id)`, `markAllDismissed(toasts)`; `ToastContainer` props become `{ entry; timers; onDismiss(id); onExited(id); getFocusFallback(from: HTMLElement | null): HTMLElement | null }`; the container renders `data-presence` (and `inert` while exiting).

- [ ] **Step 1: Write the failing tests**

In `Toast.parts.test.tsx`, add `fireEvent` to the `@testing-library/react` import, `mockAnimations` and `mockMatchMedia` to the `test-utils` import, and `getLiveRegion` to the harness import. Append:

```tsx
describe('presence (P3-02, D29)', () => {
  const isToast = (el: Element) => el.hasAttribute('data-wave-toast');

  it('keeps a dismissed toast mounted, exiting and inert until its exit ends', async () => {
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const motion = mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster();
    const id = dispatch({ title: 'Saved', timeout: 0 });
    const [container] = getToasts();
    expect(container).toHaveAttribute('data-presence', 'entering');
    await act(async () => {
      await motion.finishAll();
    });
    expect(container).toHaveAttribute('data-presence', 'entered');

    dismiss(id);
    expect(container).toHaveAttribute('data-presence', 'exiting');
    expect(container).toHaveAttribute('inert');
    // No longer announced.
    expect(getLiveRegion('polite')).toBeEmptyDOMElement();
    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toHaveLength(0);
  });

  it('ends the exit at once under reduced motion', () => {
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster();
    const id = dispatch({ title: 'Saved', timeout: 0 });
    expect(getToasts()[0]).toHaveAttribute('data-presence', 'entered');
    dismiss(id);
    expect(getToasts()).toHaveLength(0);
  });

  it('does not count a dismissed toast toward limit: the next one shows at once', async () => {
    const motion = mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster({ limit: 1 });
    const first = dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toHaveLength(1);
    dismiss(first);
    const [exiting, shown] = getToasts();
    expect(exiting).toHaveAttribute('data-presence', 'exiting');
    expect(shown).toHaveTextContent('Second');
    expect(shown).not.toHaveAttribute('inert');
    expect(getLiveRegion('polite')).toHaveTextContent('Info: Second');
    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toEqual([shown]);
  });

  it('revives an exiting toast dispatched again with its id', async () => {
    const motion = mockAnimations({ animated: isToast });
    const { dispatch, dismiss } = renderToaster();
    dispatch({ toastId: 'sync', title: 'Syncing…', timeout: 0 });
    await act(async () => {
      await motion.finishAll();
    });
    const [container] = getToasts();
    dismiss('sync');
    expect(container).toHaveAttribute('data-presence', 'exiting');
    dispatch({ toastId: 'sync', status: 'success', title: 'Synced', timeout: 0 });
    expect(getToasts()).toEqual([container]);
    expect(container).toHaveAttribute('data-presence', 'entering');
    expect(container).not.toHaveAttribute('inert');
    expect(getLiveRegion('polite')).toHaveTextContent('Success: Synced');
    await act(async () => {
      await motion.finishAll();
    });
    expect(container).toHaveAttribute('data-presence', 'entered');
    expect(getToasts()).toEqual([container]);
  });

  it('moves focus in the dismissing commit to the next toast that is not exiting', async () => {
    const motion = mockAnimations({ animated: isToast });
    const user = userEvent.setup();
    const { dispatch, dismiss } = renderToaster();
    dispatch({ title: 'First', timeout: 0 });
    const second = dispatch({ title: 'Second', timeout: 0 });
    dispatch({ title: 'Third', timeout: 0 });
    await act(async () => {
      await motion.finishAll();
    });
    const [first, secondContainer, third] = getToasts();
    dismiss(second);
    await user.click(within(first).getByRole('button', { name: 'Dismiss' }));
    // Two toasts exit at once; focus skips both and lands on Third before either exit ends.
    expect(within(third).getByRole('button', { name: 'Dismiss' })).toHaveFocus();
    expect(first).toHaveAttribute('data-presence', 'exiting');
    expect(secondContainer).toHaveAttribute('data-presence', 'exiting');
    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toEqual([third]);
  });

  it('moves focus from a focused container to the next container itself', () => {
    const { dispatch, dismiss } = renderToaster();
    const first = dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    const [firstContainer, secondContainer] = getToasts();
    act(() => firstContainer.focus());
    dismiss(first);
    expect(secondContainer).toHaveFocus();
  });

  it('keeps the return target when the browser blurs a dismissed toast later (focus fix-up)', async () => {
    const motion = mockAnimations({ animated: isToast });
    const user = userEvent.setup();
    const { dispatch, dismiss } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    const first = dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    await act(async () => {
      await motion.finishAll();
    });
    await user.click(input);
    await user.tab();
    const [firstContainer, second] = getToasts();
    const firstButton = within(firstContainer).getByRole('button', { name: 'Dismiss' });
    expect(firstButton).toHaveFocus();
    dismiss(first);
    const secondButton = within(second).getByRole('button', { name: 'Dismiss' });
    expect(secondButton).toHaveFocus();
    // A browser's focus fix-up blurs the inert, exiting subtree later, with <body> active.
    const active = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(document.body);
    fireEvent.focusOut(firstButton, { relatedTarget: null });
    active.mockRestore();
    await user.keyboard('{Enter}');
    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toHaveLength(0);
    expect(input).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/Toast.parts.test.tsx -t "presence"`
Expected: FAIL — the container has no `data-presence`, and a dismissed toast is removed at once.

- [ ] **Step 3: Entries, queue and dismissal in `Toaster.tsx`**

Replace `ToastEntry` and `promoteQueued`, and add the two helpers after `promoteQueued`:

```ts
interface ToastEntry {
  id: string;
  options: ToastOptions;
  /** Increases with every dispatch, so a replaced toast is announced again. */
  seq: number;
  /**
   * Whether the toast is shown (rendered, announced, its timer running) or still waits beyond the
   * Toaster's `limit`. Only {@link promoteQueued} sets it; it never goes back to `false`.
   */
  shown: boolean;
  /**
   * Dismissed: its container exits (not announced, no timer, not counted toward `limit`) and the
   * entry is removed when the exit ends; a dispatch with its id revives it (D29).
   */
  dismissed: boolean;
}

/**
 * Flags the oldest waiting toasts as shown while fewer than `limit` toasts are shown and not
 * dismissed. Returns `toasts` itself when nothing changes, so the Toaster's render-time update
 * settles.
 */
function promoteQueued(toasts: ToastEntry[], limit: number): ToastEntry[] {
  let active = 0;
  let waiting = false;
  for (const toast of toasts) {
    if (!toast.shown) waiting = true;
    else if (!toast.dismissed) active += 1;
  }
  if (!waiting || active >= limit) return toasts;
  return toasts.map((toast) => {
    if (toast.shown || active >= limit) return toast;
    active += 1;
    return { ...toast, shown: true };
  });
}

/** Dismisses a shown toast (it exits) and drops a waiting one; `toasts` itself when nothing changes. */
function markDismissed(toasts: ToastEntry[], id: string): ToastEntry[] {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index === -1) return toasts;
  const toast = toasts[index];
  if (!toast.shown) return [...toasts.slice(0, index), ...toasts.slice(index + 1)];
  if (toast.dismissed) return toasts;
  const next = toasts.slice();
  next[index] = { ...toast, dismissed: true };
  return next;
}

/** Dismisses every shown toast and drops the waiting ones; `toasts` itself when nothing changes. */
function markAllDismissed(toasts: ToastEntry[]): ToastEntry[] {
  if (toasts.every((toast) => toast.shown && toast.dismissed)) return toasts;
  return toasts
    .filter((toast) => toast.shown)
    .map((toast) => (toast.dismissed ? toast : { ...toast, dismissed: true }));
}
```

In `Toaster`, replace the timers state, the timer-start effect, `dispatchToast`, `dismissToast` and `dismissAllToasts`, and add `removeExited` after them:

```tsx
  const [timers] = React.useState(() =>
    createToastTimers((id) => setToasts((prev) => markDismissed(prev, id))),
  );
```

```tsx
  // Starts the timer of every newly shown toast, and restarts it for a shown toast dispatched again
  // (a new `seq`); `timers.start` ignores a dispatch it has already started. A dismissed toast has
  // none.
  React.useEffect(() => {
    for (const toast of toasts) {
      if (toast.shown && !toast.dismissed) {
        timers.start(toast.id, toast.seq, toast.options.timeout ?? DEFAULT_TIMEOUT);
      }
    }
  }, [toasts, timers]);

  // A new toast waits until the render promotes it; a replaced one keeps its place and whether it
  // is shown (a waiting toast keeps waiting with the new options), and an exiting one is revived.
  const dispatchToast = React.useCallback(
    (options: ToastOptions): string => {
      counterRef.current += 1;
      const seq = counterRef.current;
      const id = options.toastId ?? `${prefix}-${seq}`;
      setToasts((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index === -1) return [...prev, { id, options, seq, shown: false, dismissed: false }];
        const next = prev.slice();
        next[index] = { id, options, seq, shown: prev[index].shown, dismissed: false };
        return next;
      });
      return id;
    },
    [prefix],
  );

  const dismissToast = React.useCallback(
    (id: string) => {
      timers.remove(id);
      setToasts((prev) => markDismissed(prev, id));
    },
    [timers],
  );

  const dismissAllToasts = React.useCallback(() => {
    timers.clear();
    setToasts((prev) => markAllDismissed(prev));
  }, [timers]);

  // The exit of a dismissed toast ended: remove it (one revived meanwhile stays).
  const removeExited = React.useCallback((id: string) => {
    setToasts((prev) =>
      prev.some((t) => t.id === id && t.dismissed)
        ? prev.filter((t) => !(t.id === id && t.dismissed))
        : prev,
    );
  }, []);
```

Replace `getFocusFallback`:

```tsx
  // Where focus goes when the focused toast is dismissed (in its dismissing commit) or removed with
  // the Toaster: the next toast that is not exiting, else the previous one — that container itself
  // when focus was on the dismissed container (after Delete or the shortcut), else its first
  // tabbable element — else the element focused before focus entered the toasts. Runs possibly
  // after the whole Toaster is gone: never throws.
  const getFocusFallback = React.useCallback((from: HTMLElement | null): HTMLElement | null => {
    const viewport = viewportRef.current;
    const containers = viewport
      ? Array.from(viewport.children).filter(
          (el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('data-wave-toast'),
        )
      : [];
    const onContainer = !!from && from.ownerDocument.activeElement === from;
    const index = from ? containers.indexOf(from) : -1;
    const isLive = (el: HTMLElement) =>
      el !== from && el.isConnected && el.getAttribute('data-presence') !== 'exiting';
    const next = containers.slice(index + 1).find(isLive);
    const previous = index > 0 ? containers.slice(0, index).reverse().find(isLive) : undefined;
    for (const candidate of [next, previous]) {
      if (!candidate) continue;
      const target = onContainer ? candidate : getFirstTabbable(candidate);
      if (target) return target;
    }
    // Focus leaves the toasts here without a blur of the viewport (the focused node is inert or
    // gone), so the element is forgotten as it is used: a toast focused later from nowhere does not
    // send focus back to it.
    const previousFocus = previousFocusRef.current;
    previousFocusRef.current = null;
    return previousFocus?.isConnected ? previousFocus : null;
  }, []);
```

In `forgetFocusOrigin`, after the `if (to instanceof Node && viewport.contains(to)) return;` line add:

```tsx
    // A blur from inside a dismissed (exiting, inert) toast: the Toaster has moved focus itself,
    // or a browser's focus fix-up blurs the inert subtree later.
    if (event.target.closest('[data-wave-toast][data-presence="exiting"]')) return;
```

In the live-message loop skip dismissed toasts:

```tsx
  // Only shown toasts are announced (a waiting toast is announced when it appears), and a
  // dismissed one no longer is.
  for (const toast of shownToasts) {
    if (toast.dismissed) continue;
    const message = <LiveMessage key={toast.seq} text={getAnnouncement(toast.options)} />;
    (toast.options.status === 'error' ? assertive : polite).push(message);
  }
```

Update the JSDoc of `ToastOptions.toastId` and `ToastController.dismissToast`:

```ts
  /**
   * Identifier of the toast. `dispatchToast` returns it (a generated one when omitted). Dispatching
   * again with the id of a toast that is shown, or still exiting after its dismissal, replaces or
   * revives that toast (content and timer); with the id of a toast that waits beyond the Toaster's
   * `limit`, it replaces its options and the toast keeps its place in the queue.
   */
  toastId?: string;
```

```ts
  /**
   * Dismisses the toast with this id and cancels its timer: a shown toast exits (it stays, inert,
   * until an exit motion of yours ends), a waiting one is removed. Unknown ids are ignored.
   */
  dismissToast: (id: string) => void;
```

- [ ] **Step 4: Mount every container through the presence core**

Replace `ToastContainerProps` and the start of `ToastContainer` (up to `const titleId = …`), the root element's `ref`, and add the presence attributes:

```tsx
interface ToastContainerProps {
  entry: ToastEntry;
  timers: ToastTimers;
  onDismiss: (id: string) => void;
  onExited: (id: string) => void;
  getFocusFallback: (from: HTMLElement | null) => HTMLElement | null;
}

function ToastContainer({ entry, timers, onDismiss, onExited, getFocusFallback }: ToastContainerProps) {
  const { id, options, dismissed } = entry;
  // Mounted through the presence core (D29): a dismissed toast exits, `inert`, and is removed when
  // its exit ends (at once without motion); dispatching its id again revives it.
  const { isMounted, ref: presenceRef, presenceProps } = usePresence(!dismissed, {
    appear: true,
    onExited: () => onExited(id),
  });
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  // The last element, for the focus fallback, which may run after the container has unmounted.
  const lastElementRef = React.useRef<HTMLDivElement | null>(null);
  const attach = React.useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (node) lastElementRef.current = node;
  }, []);
  const mergedRef = useMergedRefs<HTMLDivElement>(attach, presenceRef);
  // Focus leaves a dismissed toast in its dismissing commit: `enabled` flipping to `false` moves it
  // in the layout phase, while the inert node is still there; a toast removed with the Toaster
  // moves it after the unmount.
  usePreserveFocus(containerRef, () => getFocusFallback(lastElementRef.current), {
    enabled: !dismissed,
  });
  const titleId = useId('wave-toast-title');
```

Before the `return` of `ToastContainer` add `if (!isMounted) return null;` (after every hook), change `ref={containerRef}` to `ref={mergedRef}` and add `{...presenceProps}` as the last attribute before `onPointerEnter`. Add `import { usePresence } from '../../hooks/usePresence';` to the imports.

Render the containers with the new props:

```tsx
          {shownToasts.map((toast) => (
            <ToastContainer
              key={toast.id}
              entry={toast}
              timers={timers}
              onDismiss={dismissToast}
              onExited={removeExited}
              getFocusFallback={getFocusFallback}
            />
          ))}
```

and replace the comment above it with `{/* Shown toasts, exiting ones included: getFocusFallback walks the containers in this order. */}`.

- [ ] **Step 5: Run the tests and quick checks**

Run: `npx vitest run src/components/feedback/__tests__/Toast.parts.test.tsx src/components/feedback/__tests__/Toast.test.tsx src/__tests__/integration.test.tsx --reporter=default`
Expected: PASS. Without motion a dismissed toast unmounts inside the same `act()`, so the 0.7 counts, texts, timer counts (the presence core schedules no timer) and focus moves hold.

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/feedback/Toaster.tsx src/components/feedback/__tests__/Toast.parts.test.tsx --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/Toaster.tsx"`
Expected: no errors; PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/feedback/Toaster.tsx src/components/feedback/__tests__/Toast.parts.test.tsx
git commit -m "feat(feedback): toasts exit through the presence core; focus leaves a dismissed toast at once"
```

---

### Task T7: `dispatchToast(content, options?)` — recognition and the content form

**Files:**
- Create: `src/lib/toaster.ts`, `src/lib/__tests__/toaster.test.ts`, `src/components/feedback/__tests__/Toaster.content.test.tsx`
- Modify: `src/components/feedback/Toaster.tsx`, `src/components/feedback/Toast.tsx`, `src/components/feedback/__tests__/toasterHarness.tsx`

**Interfaces:**
- Consumes: the container and its registrations (T5, T6); `StatusText({ label, id })`.
- Produces:
  - `src/lib/toaster.ts`: `export function isToastOptions(value: unknown): value is ToastOptions`.
  - `Toaster.tsx`: `export interface ToastDispatchOptions { toastId?: string; timeout?: number; status?: Status; statusLabel?: string; announcement?: string }`; `ToastController['dispatchToast']: { (content: React.ReactNode, options?: ToastDispatchOptions): string; (options: ToastOptions): string }`; entries `ToastEntry = { id; seq; shown; dismissed } & ({ form: 'options'; options: ToastOptions } | { form: 'content'; content: React.ReactNode; options: ToastDispatchOptions })`.
  - `Toast.tsx` re-exports `ToastDispatchOptions`.
  - Harness: `renderToaster(...)` also returns `dispatchContent(content: React.ReactNode, options?: ToastDispatchOptions): string`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/toaster.test.ts`:

```ts
import * as React from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, it } from 'vitest';
import { isToastOptions } from '../toaster';

describe('isToastOptions (P3-01, D12)', () => {
  it.each([
    ['an element', React.createElement('span', null, 'Saved')],
    ['a portal', createPortal(React.createElement('span'), document.createElement('div'))],
    ['a string', 'Saved'],
    ['a number', 42],
    ['an array', ['Saved']],
    ['a Set', new Set(['Saved'])],
    ['a Fragment', React.createElement(React.Fragment, null, 'Saved')],
    ['null', null],
    ['undefined', undefined],
    ['a thenable', Promise.resolve('Saved')],
    [
      'a generator',
      (function* lines() {
        yield 'Saved';
      })(),
    ],
  ])('reads %s as content', (_, value) => {
    expect(isToastOptions(value)).toBe(false);
  });

  it.each([
    ['a plain object', { title: 'Saved' }],
    ['an object without a prototype', Object.assign(Object.create(null) as object, { title: 'Saved' })],
  ])('reads %s as options', (_, value) => {
    expect(isToastOptions(value)).toBe(true);
  });
});
```

Add to the harness (`toasterHarness.tsx`) the type import `ToastDispatchOptions`, and inside `renderToaster` after `dispatch`:

```tsx
  const dispatchContent = (content: React.ReactNode, contentOptions?: ToastDispatchOptions): string => {
    let id = '';
    act(() => {
      id = controller().dispatchToast(content, contentOptions);
    });
    return id;
  };
```

and return it: `return { ...utils, controller, dispatch, dispatchContent, dismiss, dismissAll, setProps };`.

Create `src/components/feedback/__tests__/Toaster.content.test.tsx`:

```tsx
import * as React from 'react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast, Toaster } from '../Toast';
import type { ToastController, ToastOptions } from '../Toast';
import { expectNoA11yViolations, findDanglingIdRefs } from '../../../test-utils';
import { ControllerProbe, advance, getToasts, renderToaster } from './toasterHarness';

/** A Toast inside the app's own component (the static scan of the dispatched element cannot see it). */
function SavedToast() {
  return (
    <Toast status="success">
      <Toast.Title>Saved</Toast.Title>
      <Toast.Body>Your changes were saved.</Toast.Body>
    </Toast>
  );
}

describe('dispatchToast with content (P3-01, toast-1)', () => {
  it.each([
    ['an element', <span key="e">Saved as an element</span>, 'Saved as an element'],
    ['a string', 'Saved as text', 'Saved as text'],
    ['a number', 42, '42'],
    ['an array', ['Saved ', 'twice'], 'Saved twice'],
    ['a Fragment', <>Saved in a Fragment</>, 'Saved in a Fragment'],
  ])('renders %s as content', (_, content, text) => {
    const { dispatchContent } = renderToaster();
    dispatchContent(content, { timeout: 0 });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toHaveTextContent(text);
  });

  it('renders null as an (empty) toast of content, not as options', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(null, { timeout: 0 });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toHaveAccessibleName('Info:');
  });

  it('renders a portal as content', () => {
    const target = document.createElement('div');
    document.body.append(target);
    try {
      const { dispatchContent, unmount } = renderToaster();
      dispatchContent(createPortal(<span>In a portal</span>, target), { timeout: 0 });
      expect(getToasts()).toHaveLength(1);
      expect(target).toHaveTextContent('In a portal');
      unmount();
    } finally {
      target.remove();
    }
  });

  it('returns the given toastId, else a generated id', () => {
    const { dispatchContent } = renderToaster();
    expect(dispatchContent(<span>One</span>, { toastId: 'upload', timeout: 0 })).toBe('upload');
    const generated = dispatchContent(<span>Two</span>, { timeout: 0 });
    expect(generated).not.toBe('');
    expect(generated).not.toBe('upload');
  });

  it('names content without a Toast by a visually hidden severity text from the options, first in the container', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<p>Connection lost</p>, { status: 'warning', timeout: 0 });
    const [container] = getToasts();
    expect(container).toHaveAccessibleName('Warning:');
    expect(container.firstElementChild).toHaveClass('sr-only');
    expect(container.firstElementChild).toHaveTextContent('Warning:');
    expect(container).toHaveTextContent(/^Warning:\s*Connection lost$/);
    // No Toast inside, so no Dismiss button (D11).
    expect(within(container).queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('registers a Toast inside the app’s own component: name, description, Dismiss button, its own severity', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<SavedToast />, { timeout: 0 });
    const [container] = getToasts();
    expect(container).toHaveAccessibleName('Success: Saved');
    expect(container).toHaveAccessibleDescription('Your changes were saved.');
    expect(within(container).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    // The Toast's severity text only: the container renders none of its own.
    expect(within(container).getAllByText('Success:')).toHaveLength(1);
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('describes the container by a consumer id on Toast.Body', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title>Saved</Toast.Title>
        <Toast.Body id="save-details">Saved to Documents.</Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    expect(getToasts()[0]).toHaveAttribute('aria-describedby', 'save-details');
  });

  it('re-labels the container when a toast is replaced with another part set, with no dangling id', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="error">
        <Toast.Title>Upload failed</Toast.Title>
        <Toast.Body>The file is too large.</Toast.Body>
      </Toast>,
      { toastId: 'upload', timeout: 0 },
    );
    const [container] = getToasts();
    expect(container).toHaveAccessibleName('Error: Upload failed');
    expect(container).toHaveAccessibleDescription('The file is too large.');

    dispatchContent(
      <Toast status="error">
        <Toast.Body>Retrying…</Toast.Body>
      </Toast>,
      { toastId: 'upload', timeout: 0 },
    );
    expect(getToasts()).toEqual([container]);
    expect(container).toHaveAccessibleName('Error:');
    expect(container).toHaveAccessibleDescription('Retrying…');
    expect(findDanglingIdRefs()).toEqual([]);

    dispatchContent(
      <Toast status="error" statusLabel="">
        <Toast.Title>Offline</Toast.Title>
      </Toast>,
      { toastId: 'upload', timeout: 0 },
    );
    expect(container).toHaveAccessibleName('Offline');
    expect(container).not.toHaveAttribute('aria-describedby');
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('keeps one toast when the same toastId is dispatched twice in one tick; the second wins', () => {
    const { controller } = renderToaster();
    act(() => {
      controller().dispatchToast(<p>First version</p>, { toastId: 'sync', timeout: 0 });
      controller().dispatchToast(<p>Second version</p>, { toastId: 'sync', timeout: 0 });
    });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toHaveTextContent('Second version');
    expect(screen.queryByText('First version')).not.toBeInTheDocument();
  });

  it('adds one toast per dispatch under StrictMode', () => {
    const controllerRef = React.createRef<ToastController>();
    render(
      <React.StrictMode>
        <Toaster>
          <ControllerProbe ref={controllerRef} />
        </Toaster>
      </React.StrictMode>,
    );
    act(() => {
      controllerRef.current?.dispatchToast(<SavedToast />, { timeout: 0 });
    });
    expect(getToasts()).toHaveLength(1);
  });

  describe('Toast.Close and the Dismiss button in the Toaster', () => {
    it('Toast.Close calls the Toast’s onDismiss first, then dismisses the toast', async () => {
      const user = userEvent.setup();
      const calls: number[] = [];
      const { dispatchContent } = renderToaster();
      dispatchContent(
        <Toast onDismiss={() => calls.push(getToasts().length)}>
          <Toast.Title
            action={
              <Toast.Close>
                <button type="button">Got it</button>
              </Toast.Close>
            }
          >
            Saved
          </Toast.Title>
        </Toast>,
        { timeout: 0 },
      );
      await user.click(screen.getByRole('button', { name: 'Got it' }));
      // onDismiss ran while the toast was still shown; then the toast left.
      expect(calls).toEqual([1]);
      expect(getToasts()).toHaveLength(0);
    });

    it('Toast.Close dismisses dispatched content without a Toast', async () => {
      const user = userEvent.setup();
      const { dispatchContent } = renderToaster();
      dispatchContent(
        <p>
          Session expires soon.{' '}
          <Toast.Close>
            <button type="button">Stay signed in</button>
          </Toast.Close>
        </p>,
        { status: 'warning' },
      );
      await user.click(screen.getByRole('button', { name: 'Stay signed in' }));
      expect(getToasts()).toHaveLength(0);
    });

    it('the Dismiss button of a dispatched Toast runs its onDismiss, then dismisses', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const { dispatchContent } = renderToaster();
      dispatchContent(
        <Toast onDismiss={onDismiss}>
          <Toast.Title>Saved</Toast.Title>
        </Toast>,
        { timeout: 0 },
      );
      await user.click(within(getToasts()[0]).getByRole('button', { name: 'Dismiss' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(getToasts()).toHaveLength(0);
    });

    it('preventDefault() in the child’s onClick keeps the toast', async () => {
      const user = userEvent.setup();
      const { dispatchContent } = renderToaster();
      dispatchContent(
        <Toast>
          <Toast.Footer>
            <Toast.Close>
              <button type="button" onClick={(event) => event.preventDefault()}>
                Keep
              </button>
            </Toast.Close>
          </Toast.Footer>
        </Toast>,
        { timeout: 3000 },
      );
      await user.click(screen.getByRole('button', { name: 'Keep' }));
      expect(getToasts()).toHaveLength(1);
    });
  });

  describe('replacing by toastId', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('replaces the content and restarts the timer', () => {
      const { dispatchContent } = renderToaster();
      dispatchContent(<p>Uploading…</p>, { toastId: 'upload' });
      advance(3000);
      dispatchContent(<p>Upload complete</p>, { toastId: 'upload' });
      expect(screen.queryByText('Uploading…')).not.toBeInTheDocument();
      advance(4999);
      expect(screen.getByText('Upload complete')).toBeInTheDocument();
      advance(1);
      expect(getToasts()).toHaveLength(0);
    });
  });

  it('has no accessibility violations for rich layouts and custom content (open)', async () => {
    const { dispatchContent } = renderToaster({}, { app: <p>App content</p> });
    dispatchContent(
      <Toast status="success">
        <Toast.Title
          action={
            <Toast.Close>
              <button type="button">Undo</button>
            </Toast.Close>
          }
        >
          Email sent
        </Toast.Title>
        <Toast.Body subtitle="Just now">Your message was delivered.</Toast.Body>
        <Toast.Footer>
          <button type="button">View</button>
        </Toast.Footer>
      </Toast>,
      { timeout: 0 },
    );
    dispatchContent(<p>Connection lost</p>, { status: 'warning', timeout: 0 });
    await expectNoA11yViolations(document.body);
  });

  it('types both dispatch forms; derived parameters stay 0.7’s', () => {
    const typeOnly = (controller: ToastController) => {
      const withToast: string = controller.dispatchToast(<Toast />);
      const withOptions: string = controller.dispatchToast({ title: 'Saved' });
      const withContent: string = controller.dispatchToast(<span />, { timeout: 0 });
      // @ts-expect-error `title` is a string
      controller.dispatchToast({ title: 1 });
      // @ts-expect-error unknown option
      controller.dispatchToast({ title: 'Saved', tone: 'loud' });
      return [withToast, withOptions, withContent];
    };
    expect(typeof typeOnly).toBe('function');
    expectTypeOf<Parameters<ToastController['dispatchToast']>>().toEqualTypeOf<[options: ToastOptions]>();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/toaster.test.ts src/components/feedback/__tests__/Toaster.content.test.tsx`
Expected: FAIL — `../toaster` does not exist; `tsc -p tsconfig.dev.json` reports that `dispatchToast` expects 1 argument.

- [ ] **Step 3: Create `src/lib/toaster.ts`**

```ts
/**
 * The toaster module (P3-01, P3-08). Server-safe: it imports only types and touches no DOM, so a
 * Server Component may import it.
 */
import type { ToastOptions } from '../components/feedback/Toaster';

/**
 * Whether a `dispatchToast` argument is the options form (0.5): a plain object (prototype
 * `Object.prototype` or `null`, from any realm) that is no React node — no `$$typeof`, not
 * iterable, not a thenable (the slot-object rule of `src/lib/slot.ts`). Anything else is content:
 * an element, a portal, a string, a number, an array or another iterable, a thenable, `null`.
 */
export function isToastOptions(value: unknown): value is ToastOptions {
  if (typeof value !== 'object' || value === null) return false;
  if ('$$typeof' in value || Symbol.iterator in value) return false;
  if (typeof (value as { then?: unknown }).then === 'function') return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype || Object.getPrototypeOf(proto) === null;
}
```

- [ ] **Step 4: The content form in `Toaster.tsx`**

Add `import { isToastOptions } from '../../lib/toaster';` and `import { StatusText, getStatusLabel } from './MessageBar.status';` (replacing the `getStatusLabel`-only import). After `ToastOptions`, add:

```ts
/** Options of `dispatchToast(content, options)`, the form that shows your own React content. */
export interface ToastDispatchOptions {
  /** As `ToastOptions.toastId`: dispatching again with the id of a shown or exiting toast replaces it. */
  toastId?: string;
  /**
   * Auto-dismiss timeout in milliseconds, as `ToastOptions.timeout`.
   * @default 5000
   */
  timeout?: number;
  /**
   * Severity of content that renders no `Toast`: the announcement's politeness (`error` is
   * assertive), its spoken prefix and the container's name. A rendered `Toast` uses its own
   * `status`.
   * @default 'info'
   */
  status?: Status;
  /** Visually hidden severity text for content that renders no `Toast` (as `Toast.statusLabel`). */
  statusLabel?: string;
  /**
   * Text announced instead of the toast's title, body and action labels (the severity text still
   * comes first), for a toast whose visible text is no good announcement, such as a progress toast.
   */
  announcement?: string;
}
```

Replace the `dispatchToast` member of `ToastController`:

```ts
  /**
   * Shows a toast and returns its id. `dispatchToast(content, options?)` shows your content,
   * usually a `<Toast>` with parts; `dispatchToast(options)` builds a toast from text (0.5). A
   * plain object is read as options; anything else (an element, a portal, a string) is content. A
   * toast with the same id is replaced (revived while it exits); beyond the Toaster's `limit` the
   * toast waits in a queue. Fluent's `dispatchToast(content, options)` returns nothing.
   */
  dispatchToast: {
    (content: React.ReactNode, options?: ToastDispatchOptions): string;
    (options: ToastOptions): string;
  };
```

Replace `interface ToastEntry` with the union (the field docs stay):

```ts
/** What a dispatch stores: the options form, or your content with its options. */
type DispatchedToast =
  | { form: 'options'; options: ToastOptions }
  | { form: 'content'; content: React.ReactNode; options: ToastDispatchOptions };

type ToastEntry = DispatchedToast & {
  id: string;
  /** Increases with every dispatch, so a replaced toast is announced again. */
  seq: number;
  /**
   * Whether the toast is shown (rendered, announced, its timer running) or still waits beyond the
   * Toaster's `limit`. Only {@link promoteQueued} sets it; it never goes back to `false`.
   */
  shown: boolean;
  /**
   * Dismissed: its container exits (not announced, no timer, not counted toward `limit`) and the
   * entry is removed when the exit ends; a dispatch with its id revives it (D29).
   */
  dismissed: boolean;
};
```

Replace `INERT_CONTROLLER`:

```ts
const INERT_CONTROLLER: ToastController = {
  dispatchToast: (first: React.ReactNode | ToastOptions, second?: ToastDispatchOptions) =>
    (isToastOptions(first) ? first.toastId : second?.toastId) ?? '',
  dismissToast: () => {},
  dismissAllToasts: () => {},
};
```

Replace `dispatchToast` in `Toaster`:

```tsx
  // A new toast waits until the render promotes it; a replaced one keeps its place and whether it
  // is shown (a waiting toast keeps waiting with the new content), and an exiting one is revived.
  const dispatchToast = React.useCallback<ToastController['dispatchToast']>(
    (first: React.ReactNode | ToastOptions, second?: ToastDispatchOptions): string => {
      counterRef.current += 1;
      const seq = counterRef.current;
      const dispatched: DispatchedToast = isToastOptions(first)
        ? { form: 'options', options: first }
        : { form: 'content', content: first, options: second ?? {} };
      const id = dispatched.options.toastId ?? `${prefix}-${seq}`;
      setToasts((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        const shown = index === -1 ? false : prev[index].shown;
        const entry: ToastEntry = { ...dispatched, id, seq, shown, dismissed: false };
        if (index === -1) return [...prev, entry];
        const next = prev.slice();
        next[index] = entry;
        return next;
      });
      return id;
    },
    [prefix],
  );
```

In `ToastContainer`: change `const { id, options, dismissed } = entry;` to `const { id, dismissed } = entry;`, add after `const titleId = …`:

```tsx
  const ownStatusTextId = useId('wave-toast-status');
```

and, after `const bodyPart = …`:

```tsx
  // Content without a Toast (D10): a visually hidden severity text from the dispatch options,
  // first in the container, while no Toast has registered its own.
  const ownSeverityLabel =
    entry.form === 'content' && toast === null
      ? getStatusLabel(entry.options.status ?? 'info', entry.options.statusLabel)
      : '';
  const severityId = toast ? toast.statusTextId : ownSeverityLabel ? ownStatusTextId : undefined;
```

use `aria-labelledby={joinIds(severityId, titlePart?.id)}`, and replace the container's children with:

```tsx
      {ownSeverityLabel ? <StatusText label={ownSeverityLabel} id={ownStatusTextId} /> : null}
      <ToastContext.Provider value={context}>
        {entry.form === 'options' ? (
          <ToastRoot
            status={entry.options.status}
            statusLabel={entry.options.statusLabel}
            title={entry.options.title}
            dismissLabel={entry.options.dismissLabel}
          >
            {entry.options.body}
          </ToastRoot>
        ) : (
          entry.content
        )}
      </ToastContext.Provider>
```

In the live-message loop, announce only the options form for now (dispatched content is announced from its rendered text in Tasks T9 and T10):

```tsx
  for (const toast of shownToasts) {
    if (toast.dismissed || toast.form !== 'options') continue;
    const message = <LiveMessage key={toast.seq} text={getAnnouncement(toast.options)} />;
    (toast.options.status === 'error' ? assertive : polite).push(message);
  }
```

Rewrite the `useToastController` docblock's first paragraph and example for both forms:

```ts
/**
 * Returns the {@link ToastController} of the enclosing `<Toaster>`: `dispatchToast(content,
 * options?)` shows your content (usually a `<Toast>` with parts) and `dispatchToast(options)` a
 * toast built from text; both return the toast's id. `dismissToast(id)` dismisses one toast,
 * `dismissAllToasts()` every toast.
 *
 * Must be called inside `<Toaster>`, which provides the controller to its children — wrap the app
 * (or the part of it that shows toasts) in `<Toaster>`; a sibling `<Toaster />` does not work.
 * Outside a Toaster it throws in development; in production it logs an error (once) and returns a
 * controller that does nothing.
 *
 * @example
 * function SaveButton() {
 *   const { dispatchToast } = useToastController();
 *   return (
 *     <Button
 *       onClick={() =>
 *         dispatchToast(
 *           <Toast status="success">
 *             <Toast.Title>Saved</Toast.Title>
 *           </Toast>,
 *         )
 *       }
 *     >
 *       Save
 *     </Button>
 *   );
 * }
 * // <Toaster><App /></Toaster>
 */
```

In the `Toaster` docblock, replace the first bullet with:

```ts
 * - **Wrap the app** in `<Toaster>`; components below it call `useToastController()`.
 * - **Two ways to dispatch:** `dispatchToast(<Toast>…</Toast>)` shows your content, usually a
 *   `Toast` with `Toast.Title`, `Toast.Body` and `Toast.Footer`; `dispatchToast({ title, body })`
 *   builds a toast from text. Both return the toast's id. Content without a `Toast` takes its
 *   severity from the options (`status`, `statusLabel`) and shows no Dismiss button (add a
 *   `Toast.Close`).
```

- [ ] **Step 5: Re-export the type and name the dispatch form in `Toast.tsx`**

Add `ToastDispatchOptions` to the `./Toaster` type re-export. In the docblock, after the first sentence, add:

```tsx
 * Dispatch it with `useToastController().dispatchToast(<Toast>…</Toast>)`, or render it yourself.
```

- [ ] **Step 6: Run the tests and quick checks**

Run: `npx vitest run src/lib/__tests__/toaster.test.ts src/components/feedback/__tests__ --reporter=default`
Expected: PASS.

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/lib/toaster.ts src/lib/__tests__/toaster.test.ts src/components/feedback --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/Toast"`
Expected: no errors (the `@ts-expect-error` lines are needed errors); PASS.

Run: `npx vitest run src/__tests__/public-types.test.ts`
Expected: PASS (`ToastDispatchOptions` is on `PENDING_PUBLIC_TYPES`, Task A1).

- [ ] **Step 7: Commit**

```bash
git add src/lib/toaster.ts src/lib/__tests__/toaster.test.ts src/components/feedback/Toaster.tsx src/components/feedback/Toast.tsx src/components/feedback/__tests__/toasterHarness.tsx src/components/feedback/__tests__/Toaster.content.test.tsx
git commit -m "feat(feedback): dispatchToast with React content"
```

---

### Task T8: No timeout for a toast with an action (D12)

**Files:**
- Modify: `src/components/feedback/Toaster.tsx`
- Test: `src/components/feedback/__tests__/Toaster.content.test.tsx`

**Interfaces:**
- Consumes: `getTabbableElements` (`src/lib/focus.ts`); `ToastRegistration.getDismissButton` (T2/T5).
- Produces: the container starts its own timer after mount: `timers.start(id, seq, entry.options.timeout ?? (hasAction(node, toast) ? 0 : DEFAULT_TIMEOUT))`; the Toaster's timer-start effect is removed; module helper `hasAction(container: HTMLElement, toast: ToastRegistration | null): boolean`.

- [ ] **Step 1: Write the failing tests**

Append to `Toaster.content.test.tsx`:

```tsx
describe('the timeout of a toast with an action (P3-01, D12)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const undoToast = (onUndo: () => void = () => {}) => (
    <Toast>
      <Toast.Title
        action={
          <button type="button" onClick={onUndo}>
            Undo
          </button>
        }
      >
        Message deleted
      </Toast.Title>
    </Toast>
  );

  it('keeps a toast with an action and no timeout until it is dismissed', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(undoToast());
    advance(60_000);
    expect(screen.getByText('Message deleted')).toBeInTheDocument();
  });

  it('honours an explicit timeout on a toast with an action', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(undoToast(), { timeout: 3000 });
    advance(2999);
    expect(screen.getByText('Message deleted')).toBeInTheDocument();
    advance(1);
    expect(getToasts()).toHaveLength(0);
  });

  it('dismisses a toast without an action after 5000 ms (its Dismiss button is no action)', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<SavedToast />);
    advance(4999);
    expect(getToasts()).toHaveLength(1);
    advance(1);
    expect(getToasts()).toHaveLength(0);
  });

  it.each([
    [
      'an empty title action',
      <Toast key="t">
        <Toast.Title action={false}>Saved</Toast.Title>
      </Toast>,
    ],
    [
      'an empty footer',
      <Toast key="f">
        <Toast.Title>Saved</Toast.Title>
        <Toast.Footer>{false}</Toast.Footer>
      </Toast>,
    ],
  ])('keeps the 5 s timeout for %s: no action', (_, content) => {
    const { dispatchContent } = renderToaster();
    dispatchContent(content);
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });

  it('runs an Undo handler and pauses the timers while it has focus', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUndo = vi.fn();
    const { dispatchContent } = renderToaster();
    dispatchContent(undoToast(onUndo), { timeout: 3000 });
    advance(1000);
    const undo = screen.getByRole('button', { name: 'Undo' });
    act(() => undo.focus());
    advance(10_000);
    expect(screen.getByText('Message deleted')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onUndo).toHaveBeenCalledTimes(1);
    act(() => undo.blur());
    advance(1999);
    expect(screen.getByText('Message deleted')).toBeInTheDocument();
    advance(1);
    expect(getToasts()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/Toaster.content.test.tsx -t "timeout of a toast"`
Expected: FAIL — `keeps a toast with an action and no timeout` finds no toast after 60 s (it expired at 5 s).

- [ ] **Step 3: Start the timer in the container**

Add `getTabbableElements` to the `lib/focus` import. After `markAllDismissed`, add:

```ts
/** Whether a toast holds an action: an element in its Tab order other than its Dismiss button. */
function hasAction(container: HTMLElement, toast: ToastRegistration | null): boolean {
  const dismissButton = toast?.getDismissButton() ?? null;
  return getTabbableElements(container).some((el) => el !== dismissButton);
}
```

Delete the Toaster's timer-start `React.useEffect` (the one that loops over `toasts` and calls `timers.start`). In `ToastContainer`, before `if (!isMounted) return null;`, add:

```tsx
  // The timer of each dispatch (D12), started once the content has mounted (its registrations ran
  // first): the dispatch's `timeout`, else none for a toast with an action — people using a screen
  // reader, a switch or voice control need time to reach it — else 5000 ms.
  React.useLayoutEffect(() => {
    const node = containerRef.current;
    if (entry.dismissed || !node) return;
    const timeout =
      entry.options.timeout ?? (hasAction(node, toastRef.current) ? 0 : DEFAULT_TIMEOUT);
    timers.start(entry.id, entry.seq, timeout);
  }, [entry, timers]);
```

Update the JSDoc of `ToastDispatchOptions.timeout`:

```ts
  /**
   * Auto-dismiss timeout in milliseconds, as `ToastOptions.timeout`. A toast that holds an action
   * (an interactive element besides its Dismiss button) stays until it is dismissed unless you
   * pass one: people using a screen reader, a switch or voice control need time to reach it.
   * @default 5000, or no timeout for a toast with an action
   */
  timeout?: number;
```

- [ ] **Step 4: Run the tests and quick checks**

Run: `npx vitest run src/components/feedback/__tests__ --reporter=default`
Expected: PASS, the 0.7 timer tests included: an options-form toast has only its Dismiss button, so it keeps `timeout ?? 5000`, and `vi.getTimerCount()` still counts one dismiss timer and one announcement timer per shown toast.

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/feedback/Toaster.tsx src/components/feedback/__tests__/Toaster.content.test.tsx --max-warnings 0`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/feedback/Toaster.tsx src/components/feedback/__tests__/Toaster.content.test.tsx
git commit -m "feat(feedback): a dispatched toast with an action stays until it is dismissed"
```

---
### Task T9: Severity from the rendered Toast; `Toaster:status-conflict`

**Files:**
- Modify: `src/components/feedback/Toaster.tsx`
- Test: `src/components/feedback/__tests__/Toaster.content.test.tsx`

**Interfaces:**
- Consumes: `ToastRegistration` (`status`, `statusLabel`) from the Toast inside a container (T5).
- Produces: `interface Announcement { seq: number; text: string; assertive: boolean }` (internal); the Toaster's `announce(id: string, announcement: Announcement)` passed to every `ToastContainer` (new prop `announce`); the container composes its announcement in a layout effect: the severity text of the registered Toast (else of the dispatch options), then the text (the options form's title and body; the content form's text arrives in T10); the development warning `Toaster:status-conflict`.

- [ ] **Step 1: Write the failing tests**

In `Toaster.content.test.tsx`, add `getLiveRegion` to the harness import, then append:

```tsx
describe('severity (P3-01, D12)', () => {
  it('announces a dispatched error Toast assertively, with its own severity text', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="error">
        <Toast.Title>Upload failed</Toast.Title>
      </Toast>,
      { timeout: 0 },
    );
    expect(getLiveRegion('assertive')).toHaveTextContent(/^Error:/);
    expect(getLiveRegion('polite')).toBeEmptyDOMElement();
  });

  it('announces a dispatched success Toast politely', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<SavedToast />, { timeout: 0 });
    expect(getLiveRegion('polite')).toHaveTextContent(/^Success:/);
    expect(getLiveRegion('assertive')).toBeEmptyDOMElement();
  });

  it('uses the options’ status and statusLabel for content without a Toast', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<p>Connection lost</p>, { status: 'error', statusLabel: 'Fehler:', timeout: 0 });
    expect(getLiveRegion('assertive')).toHaveTextContent(/^Fehler:/);
    expect(getToasts()[0]).toHaveAccessibleName('Fehler:');
  });

  it('uses the rendered Toast’s status over an explicit option, with one development warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="error">
        <Toast.Title>Upload failed</Toast.Title>
      </Toast>,
      { status: 'info', timeout: 0 },
    );
    expect(getLiveRegion('assertive')).toHaveTextContent(/^Error:/);
    expect(getToasts()[0]).toHaveAccessibleName('Error: Upload failed');
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Toaster: the dispatched Toast has status "error" but the dispatch options pass "info"; the Toast\'s status is used. Remove `status` from the options.',
      ],
    ]);
    warn.mockRestore();
  });

  it('does not warn when the options pass no status, or the Toast’s own', () => {
    const warn = vi.spyOn(console, 'warn');
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="error">
        <Toast.Title>Upload failed</Toast.Title>
      </Toast>,
      { timeout: 0 },
    );
    dispatchContent(
      <Toast status="warning">
        <Toast.Title>Disk almost full</Toast.Title>
      </Toast>,
      { status: 'warning', timeout: 0 },
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps the 0.7 announcement of the options form', () => {
    const { dispatch } = renderToaster();
    dispatch({ status: 'error', title: 'Upload failed', body: 'Try again.', timeout: 0 });
    expect(getLiveRegion('assertive').textContent).toBe('Error: Upload failed Try again.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/Toaster.content.test.tsx -t "severity"`
Expected: FAIL — dispatched content is not announced (both live regions are empty) and no warning is logged.

- [ ] **Step 3: The announcement pipeline**

In `Toaster.tsx`, delete `getAnnouncement` and add after `ANNOUNCEMENT_DURATION`:

```ts
/** A toast's message for the live regions, composed by its container after it mounts (D13). */
interface Announcement {
  /** The dispatch it belongs to: a replacement (a new `seq`) is announced again. */
  seq: number;
  text: string;
  /** `error` toasts are announced assertively, every other status politely. */
  assertive: boolean;
}
```

In `Toaster`, after the `toasts` state, add:

```tsx
  // Each toast's message, written by its container after the toast mounts (a layout effect), so
  // the severity is the rendered Toast's and the text what the toast renders.
  const [announcements, setAnnouncements] = React.useState<ReadonlyMap<string, Announcement>>(
    () => new Map(),
  );
  const announce = React.useCallback((id: string, announcement: Announcement) => {
    setAnnouncements((prev) => {
      const current = prev.get(id);
      if (
        current &&
        current.seq === announcement.seq &&
        current.text === announcement.text &&
        current.assertive === announcement.assertive
      ) {
        return prev;
      }
      const next = new Map(prev);
      next.set(id, announcement);
      return next;
    });
  }, []);
```

extend `removeExited` so it also forgets the message:

```tsx
  // The exit of a dismissed toast ended: remove it and its message (one revived meanwhile stays).
  const removeExited = React.useCallback((id: string) => {
    setToasts((prev) =>
      prev.some((t) => t.id === id && t.dismissed)
        ? prev.filter((t) => !(t.id === id && t.dismissed))
        : prev,
    );
    setAnnouncements((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);
```

replace the live-message loop:

```tsx
  // Each shown toast's message for its first 2 s, while it is not dismissed (a waiting toast is
  // announced when it appears); a replacement is a new dispatch, so it is read again.
  const polite: React.ReactNode[] = [];
  const assertive: React.ReactNode[] = [];
  for (const toast of shownToasts) {
    if (toast.dismissed) continue;
    const announcement = announcements.get(toast.id);
    if (!announcement || announcement.seq !== toast.seq || !announcement.text) continue;
    const message = <LiveMessage key={announcement.seq} text={announcement.text} />;
    (announcement.assertive ? assertive : polite).push(message);
  }
```

and pass `announce={announce}` to every `<ToastContainer>`.

- [ ] **Step 4: Compose the announcement and warn in `ToastContainer`**

Add `announce: (id: string, announcement: Announcement) => void;` to `ToastContainerProps`, destructure `announce`, and before `if (!isMounted) return null;` add:

```tsx
  // What screen readers hear (D13), once per dispatch after the content has mounted: the severity
  // text of the rendered Toast (else the dispatch options'), then the toast's text; `error` is
  // assertive.
  React.useLayoutEffect(() => {
    if (entry.dismissed) return;
    const registered = toastRef.current;
    const status = registered?.status ?? entry.options.status ?? 'info';
    const label = registered
      ? registered.statusLabel
      : getStatusLabel(status, entry.options.statusLabel);
    const text = entry.form === 'options' ? [entry.options.title, entry.options.body] : [];
    announce(entry.id, {
      seq: entry.seq,
      text: [label, ...text].filter(Boolean).join(' '),
      assertive: status === 'error',
    });
  }, [entry, announce]);

  // A rendered Toast's severity wins over the dispatch options' (D12); an explicit, different
  // `status` in the options warns once.
  const optionStatus = entry.form === 'content' ? entry.options.status : undefined;
  const toastStatus = toast?.status;
  React.useEffect(() => {
    if (optionStatus === undefined || toastStatus === undefined || optionStatus === toastStatus) {
      return;
    }
    warnOnce(
      'Toaster:status-conflict',
      `Toaster: the dispatched Toast has status "${toastStatus}" but the dispatch options pass "${optionStatus}"; the Toast's status is used. Remove \`status\` from the options.`,
    );
  }, [optionStatus, toastStatus]);
```

Update the JSDoc of `ToastDispatchOptions.status`:

```ts
  /**
   * Severity of content that renders no `Toast`: the announcement's politeness (`error` is
   * assertive), its spoken prefix and the container's name. A rendered `Toast` uses its own
   * `status`; a different value passed here warns in development.
   * @default 'info'
   */
  status?: Status;
```

- [ ] **Step 5: Run the tests and quick checks**

Run: `npx vitest run src/components/feedback/__tests__ --reporter=default`
Expected: PASS; the 0.7 announcement tests still see "Error: Upload failed Try again." (the options form), and their timer counts hold (one `LiveMessage` timer per shown toast).

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/feedback/Toaster.tsx src/components/feedback/__tests__/Toaster.content.test.tsx --max-warnings 0`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/feedback/Toaster.tsx src/components/feedback/__tests__/Toaster.content.test.tsx
git commit -m "feat(feedback): toast severity from the rendered Toast, with a status-conflict warning"
```

---

### Task T10: What screen readers hear — the accessible-text walk and `announcement`

**Files:**
- Modify: `src/components/feedback/Toaster.tsx`, `src/components/feedback/Toast.tsx` (the docblock bullet)
- Test: `src/components/feedback/__tests__/Toaster.content.test.tsx`

**Interfaces:**
- Consumes: the part registrations (T2, T5) through the container's `partsRef`; `ToastDispatchOptions.announcement` (T7).
- Produces: module helpers `getAccessibleText(root: Element | null, skip?: (el: Element) => boolean): string` and `composeToastText(container, parts, toast, ownStatusTextId): string` in `Toaster.tsx`; the container announces `severity + (announcement ?? composed text)`.

- [ ] **Step 1: Write the failing tests**

Append to `Toaster.content.test.tsx`:

```tsx
describe('announcements (P3-01, D13)', () => {
  it('announces a rich toast once: severity, title, body, action labels, never "Dismiss"', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="error">
        <Toast.Title action={<button type="button">Retry</button>}>Upload failed</Toast.Title>
        <Toast.Body>The file is too large.</Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    const assertive = getLiveRegion('assertive');
    expect(assertive.textContent).toBe('Error: Upload failed The file is too large. Retry');
    expect(assertive.childElementCount).toBe(1);
    // No provider or announcer is mounted: the Toaster's own live regions announce.
    expect(document.querySelector('[data-wave-announcer]')).toBeNull();
  });

  it('reads the subtitle with the body and the footer’s labels after it', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="success">
        <Toast.Title>Email sent</Toast.Title>
        <Toast.Body subtitle="Just now">Your message was delivered.</Toast.Body>
        <Toast.Footer>
          <button type="button">Undo</button>
          <button type="button" aria-label="Open the sent folder">
            <svg aria-hidden="true" />
          </button>
        </Toast.Footer>
      </Toast>,
      { timeout: 0 },
    );
    expect(getLiveRegion('polite').textContent).toBe(
      'Success: Email sent Your message was delivered. Just now Undo Open the sent folder',
    );
  });

  it('skips aria-hidden text and reads an image’s alt', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Body>
          Sent to <img src="data:," alt="Ada Lovelace" />
          <span aria-hidden="true"> ✓</span>
        </Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    expect(getLiveRegion('polite').textContent).toBe('Info: Sent to Ada Lovelace');
  });

  it('reads content without a Toast whole, after the options’ severity text', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <div>
        <strong>3 files</strong> uploaded <button type="button">View</button>
      </div>,
      { status: 'success', timeout: 0 },
    );
    expect(getLiveRegion('polite').textContent).toBe('Success: 3 files uploaded View');
  });

  it('announces `announcement` instead of the text; statusLabel "" drops the severity', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title>Uploading report.pdf</Toast.Title>
        <Toast.Body>
          <progress aria-label="Upload progress" value={30} max={100} />
        </Toast.Body>
      </Toast>,
      { announcement: 'Upload started', timeout: 0 },
    );
    dispatchContent(<p>Quiet</p>, { statusLabel: '', announcement: 'Hello', timeout: 0 });
    const texts = Array.from(getLiveRegion('polite').children, (child) => child.textContent);
    expect(texts).toEqual(['Info: Upload started', 'Hello']);
  });

  it('announces a toast replaced by its toastId again, with the new text', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<p>One</p>, { toastId: 'sync', timeout: 0 });
    dispatchContent(<p>Two</p>, { toastId: 'sync', timeout: 0 });
    const polite = getLiveRegion('polite');
    expect(polite.textContent).toBe('Info: Two');
    expect(polite.childElementCount).toBe(1);
  });

  it('announces the second of two same-id dispatches in one tick, once', () => {
    const { controller } = renderToaster();
    act(() => {
      controller().dispatchToast(<p>First version</p>, { toastId: 'sync', timeout: 0 });
      controller().dispatchToast(<p>Second version</p>, { toastId: 'sync', timeout: 0 });
    });
    const polite = getLiveRegion('polite');
    expect(polite.textContent).toBe('Info: Second version');
    expect(polite.childElementCount).toBe(1);
  });

  it('announces once per dispatch under StrictMode', () => {
    const controllerRef = React.createRef<ToastController>();
    render(
      <React.StrictMode>
        <Toaster>
          <ControllerProbe ref={controllerRef} />
        </Toaster>
      </React.StrictMode>,
    );
    act(() => {
      controllerRef.current?.dispatchToast(<SavedToast />, { timeout: 0 });
    });
    const polite = getLiveRegion('polite');
    expect(polite.childElementCount).toBe(1);
    expect(polite.textContent).toBe('Success: Saved Your changes were saved.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/Toaster.content.test.tsx -t "announcements"`
Expected: FAIL — a dispatched toast is announced as its severity text only ("Error:").

- [ ] **Step 3: The accessible-text walk and the composition**

In `Toaster.tsx`, after `isBodyPart`, add:

```ts
function isFooterPart(
  part: ToastPartRegistration,
): part is Extract<ToastPartRegistration, { kind: 'footer' }> {
  return part.kind === 'footer';
}

/** Elements whose text runs on without a break; every other element separates its text. */
const INLINE_ELEMENTS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'label',
  'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var',
]);

/** Elements a screen reader names by their `aria-label` rather than by their content. */
const NAMED_BY_LABEL = new Set(['a', 'button', 'img', 'input', 'select', 'svg', 'textarea']);

/**
 * The text a screen reader reads for `root`'s content (D13): text nodes, an image's `alt` and the
 * `aria-label` of a control; `aria-hidden="true"` and `hidden` subtrees, and elements `skip`
 * accepts, are left out; whitespace is collapsed. Fluent reads the raw text content instead, which
 * includes hidden text and misses `alt` text.
 */
function getAccessibleText(root: Element | null, skip?: (el: Element) => boolean): string {
  if (!root) return '';
  const parts: string[] = [];
  const visit = (node: Node, isRoot: boolean): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (!isRoot && skip?.(el)) return;
    if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden')) return;
    const label = el.getAttribute('aria-label');
    if (label && (NAMED_BY_LABEL.has(el.localName) || el.hasAttribute('role'))) {
      parts.push(` ${label} `);
      return;
    }
    if (el.localName === 'img') {
      parts.push(` ${el.getAttribute('alt') ?? ''} `);
      return;
    }
    const separate = !INLINE_ELEMENTS.has(el.localName);
    if (separate) parts.push(' ');
    for (const child of Array.from(el.childNodes)) visit(child, false);
    if (separate) parts.push(' ');
  };
  visit(root, true);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

/**
 * A toast's announced text after its severity (D13): the title, the body (its subtitle included),
 * then the labels of its actions (the title's `action` and the footer, never the Dismiss button).
 * Content without a title or body part is read whole, without the severity texts.
 */
function composeToastText(
  container: HTMLElement,
  parts: readonly ToastPartRegistration[],
  toast: ToastRegistration | null,
  ownStatusTextId: string,
): string {
  const title = parts.find(isTitlePart);
  const body = parts.find(isBodyPart);
  if (!title && !body) {
    const dismissButton = toast?.getDismissButton() ?? null;
    return getAccessibleText(
      container,
      (el) =>
        el === dismissButton ||
        (el.id !== '' && (el.id === ownStatusTextId || el.id === toast?.statusTextId)),
    );
  }
  const label = title?.getLabel() ?? null;
  return [
    getAccessibleText(label),
    getAccessibleText(body?.getElement() ?? null),
    // The title row without its text: the `action` slot.
    getAccessibleText(title?.getRow() ?? null, (el) => el === label),
    ...parts.filter(isFooterPart).map((footer) => getAccessibleText(footer.getElement())),
  ]
    .filter(Boolean)
    .join(' ');
}
```

Replace the announcement layout effect of `ToastContainer`:

```tsx
  // What screen readers hear (D13), once per dispatch after the content has mounted: the severity
  // text of the rendered Toast (else the dispatch options'), then `announcement` or the text the
  // toast renders; `error` is assertive.
  React.useLayoutEffect(() => {
    const node = containerRef.current;
    if (entry.dismissed || !node) return;
    const registered = toastRef.current;
    const status = registered?.status ?? entry.options.status ?? 'info';
    const label = registered
      ? registered.statusLabel
      : getStatusLabel(status, entry.options.statusLabel);
    const text =
      entry.form === 'content' && entry.options.announcement !== undefined
        ? entry.options.announcement
        : composeToastText(node, partsRef.current, registered, ownStatusTextId);
    announce(entry.id, {
      seq: entry.seq,
      text: [label, text].filter(Boolean).join(' '),
      assertive: status === 'error',
    });
  }, [entry, announce, ownStatusTextId]);
```

- [ ] **Step 4: Say what is announced in the `Toast` docblock**

In `Toast.tsx`, replace the "In a Toaster" bullet:

```tsx
 * - **In a Toaster**: not a live region itself; the Toaster announces it once through its
 *   permanent live regions (its severity text, title, body and the labels of its actions, never
 *   the Dismiss button), politely or, for `error`, assertively, and names its container by the
 *   severity text and title. Every Toast there shows the Dismiss button.
```

In the `Toaster` docblock (`Toaster.tsx`), replace the live-region bullet:

```ts
 * - Two permanent, visually hidden live regions (polite, and assertive for `error`) announce every
 *   toast once, read from what it renders after it mounts: the severity text, the title, the body
 *   and the labels of its actions (never the Dismiss button), or the dispatch's `announcement`.
 *   The toasts themselves are not live regions. Each message stays in its live region for 2
 *   seconds (or until its toast goes), so browsing the region later meets the text only once.
```

- [ ] **Step 5: Run the tests and quick checks**

Run: `npx vitest run src/components/feedback/__tests__ src/__tests__/integration.test.tsx --reporter=default`
Expected: PASS; the options form still announces its 0.7 text exactly ("Error: Upload failed Try again.").

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/feedback --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/Toast"`
Expected: no errors; PASS.

Run: `node scripts/build-css.mjs`
Expected: exit 0 (the new string literals, element names, generate no utility).

- [ ] **Step 6: Commit**

```bash
git add src/components/feedback/Toaster.tsx src/components/feedback/Toast.tsx src/components/feedback/__tests__/Toaster.content.test.tsx
git commit -m "feat(feedback): announce a toast's title, body and action labels, read after it mounts"
```

---

### Task T11: The focus shortcut (`shortcuts.focus`)

**Files:**
- Create: `src/components/feedback/__tests__/Toaster.keyboard.test.tsx`
- Modify: `src/components/feedback/Toaster.tsx`, `src/components/feedback/Toast.tsx` (type re-export)

**Interfaces:**
- Consumes: the container (T5, T6); `useEventCallback`.
- Produces: `export interface ToasterShortcuts { focus?: (event: KeyboardEvent) => boolean }`; `ToasterProps['shortcuts']?: ToasterShortcuts`; module helper `findNewestToast(toasts: readonly ToastEntry[]): ToastEntry | undefined`; the container prop `registerContainer: (id: string, node: HTMLElement | null) => void`; `Toast.tsx` re-exports `ToasterShortcuts`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/feedback/__tests__/Toaster.keyboard.test.tsx`:

```tsx
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from '../Toast';
import type { ToastController } from '../Toast';
import { mockAnimations } from '../../../test-utils';
import { ControllerProbe, advance, getToasts, renderToaster } from './toasterHarness';

/** The stories' shortcut: Alt+Shift+N (with modifiers, WCAG 2.1.4). */
const altShiftN = (event: KeyboardEvent) =>
  event.altKey && event.shiftKey && event.code === 'KeyN';

const pressAltShiftN = (target: Element = document.body) =>
  fireEvent.keyDown(target, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });

/** Records whether each Alt+Shift+N key press reached the document prevented. */
function recordPrevented(): boolean[] {
  const prevented: boolean[] = [];
  const record = (event: KeyboardEvent) => {
    if (event.code === 'KeyN') prevented.push(event.defaultPrevented);
  };
  document.addEventListener('keydown', record);
  onTestFinished(() => document.removeEventListener('keydown', record));
  return prevented;
}

describe('the focus shortcut (P3-03, toaster-2)', () => {
  it('focuses the newest toast’s container, prevents the key and remembers the origin', async () => {
    const user = userEvent.setup();
    const { dispatch, dismissAll } = renderToaster(
      { shortcuts: { focus: altShiftN } },
      { app: <input aria-label="Name" /> },
    );
    const prevented = recordPrevented();
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    await user.click(input);
    await user.keyboard('{Alt>}{Shift>}N{/Shift}{/Alt}');
    expect(getToasts()[1]).toHaveFocus();
    expect(prevented).toEqual([true]);
    // The origin: focus returns there once the toasts go.
    dismissAll();
    expect(input).toHaveFocus();
  });

  it('focuses the most recently dispatched toast, a replaced one included', () => {
    const { dispatch } = renderToaster({ shortcuts: { focus: altShiftN } });
    dispatch({ toastId: 'sync', title: 'Syncing…', timeout: 0 });
    dispatch({ title: 'Other', timeout: 0 });
    dispatch({ toastId: 'sync', title: 'Synced', timeout: 0 });
    pressAltShiftN();
    expect(getToasts()[0]).toHaveFocus();
  });

  it('does nothing without a toast, or when the predicate returns false', () => {
    const focus = vi.fn(altShiftN);
    const { dispatch } = renderToaster({ shortcuts: { focus } });
    const prevented = recordPrevented();
    pressAltShiftN();
    dispatch({ title: 'Saved', timeout: 0 });
    fireEvent.keyDown(document.body, { key: 'M', code: 'KeyM', altKey: true, shiftKey: true });
    expect(focus).toHaveBeenCalledTimes(2);
    expect(prevented).toEqual([false]);
    expect(getToasts()[0]).not.toHaveFocus();
  });

  it('ignores a key press that is already prevented, and one while composing', () => {
    const focus = vi.fn(altShiftN);
    const { dispatch } = renderToaster({ shortcuts: { focus } });
    dispatch({ title: 'Saved', timeout: 0 });
    const prevent = (event: KeyboardEvent) => event.preventDefault();
    window.addEventListener('keydown', prevent, true);
    pressAltShiftN();
    window.removeEventListener('keydown', prevent, true);
    fireEvent.keyDown(document.body, {
      key: 'N',
      code: 'KeyN',
      altKey: true,
      shiftKey: true,
      isComposing: true,
    });
    expect(focus).not.toHaveBeenCalled();
    expect(getToasts()[0]).not.toHaveFocus();
  });

  it('skips an exiting toast, and does nothing while every toast is dismissed', async () => {
    const motion = mockAnimations({ animated: (el) => el.hasAttribute('data-wave-toast') });
    const { dispatch, dismiss, dismissAll } = renderToaster({ shortcuts: { focus: altShiftN } });
    const prevented = recordPrevented();
    dispatch({ title: 'First', timeout: 0 });
    const second = dispatch({ title: 'Second', timeout: 0 });
    await act(async () => {
      await motion.finishAll();
    });
    const [first] = getToasts();
    dismiss(second);
    pressAltShiftN();
    expect(first).toHaveFocus();

    dismissAll();
    pressAltShiftN();
    expect(prevented).toEqual([true, false]);
    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toHaveLength(0);
  });

  it('adds one listener under StrictMode and removes it on unmount', () => {
    const focus = vi.fn(altShiftN);
    const controllerRef = React.createRef<ToastController>();
    const { unmount } = render(
      <React.StrictMode>
        <Toaster shortcuts={{ focus }}>
          <ControllerProbe ref={controllerRef} />
        </Toaster>
      </React.StrictMode>,
    );
    act(() => {
      controllerRef.current?.dispatchToast({ title: 'Saved', timeout: 0 });
    });
    pressAltShiftN();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(getToasts()[0]).toHaveFocus();
    unmount();
    pressAltShiftN();
    expect(focus).toHaveBeenCalledTimes(1);
  });

  describe('timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('pauses the timers while the shortcut has put focus in a toast', () => {
      const { dispatch } = renderToaster({ shortcuts: { focus: altShiftN } });
      dispatch({ title: 'Saved' });
      pressAltShiftN();
      advance(10_000);
      expect(getToasts()).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/Toaster.keyboard.test.tsx`
Expected: FAIL — the key press moves no focus (and `tsc -p tsconfig.dev.json` reports that `shortcuts` does not exist on `ToasterProps`).

- [ ] **Step 3: Implement the shortcut in `Toaster.tsx`**

After `ToastPosition`, add:

```ts
/** Keyboard shortcuts of a Toaster (Fluent's shape). */
export interface ToasterShortcuts {
  /**
   * Returns `true` for the key press that moves focus to the most recently dispatched toast, for
   * example `(event) => event.altKey && event.shiftKey && event.code === 'KeyN'`. Use a modifier
   * (or let people change or turn off the shortcut): a single-character shortcut fails WCAG 2.1.4.
   */
  focus?: (event: KeyboardEvent) => boolean;
}
```

In `ToasterProps`, after `limit`, add:

```ts
  /** Keyboard shortcuts; Escape, Delete and Backspace need none (see the component docs). */
  shortcuts?: ToasterShortcuts;
```

After `markAllDismissed`, add:

```ts
/** The shown, not dismissed toast dispatched last (the highest `seq`), or `undefined`. */
function findNewestToast(toasts: readonly ToastEntry[]): ToastEntry | undefined {
  let newest: ToastEntry | undefined;
  for (const toast of toasts) {
    if (toast.shown && !toast.dismissed && (!newest || toast.seq > newest.seq)) newest = toast;
  }
  return newest;
}
```

In `ToastContainerProps` add `registerContainer: (id: string, node: HTMLElement | null) => void;`, destructure it, and register the element from the container's ref callback:

```tsx
  const attach = React.useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (node) lastElementRef.current = node;
      registerContainer(id, node);
    },
    [id, registerContainer],
  );
```

In `Toaster`, destructure `shortcuts` (after `limit: limitProp`) and add after `getFocusFallback`:

```tsx
  // The latest entries and every container element, for the shortcut's document listener.
  const toastsRef = React.useRef<ToastEntry[]>(settled);
  React.useLayoutEffect(() => {
    toastsRef.current = settled;
  });
  const containersRef = React.useRef(new Map<string, HTMLElement>());
  const registerContainer = React.useCallback((id: string, node: HTMLElement | null) => {
    if (node) containersRef.current.set(id, node);
    else containersRef.current.delete(id);
  }, []);

  // The focus shortcut (D14): a document listener, so the key works wherever focus is. It focuses
  // the container of the newest toast that is shown and not dismissed and remembers where focus
  // was (unless it is already in the toasts).
  const hasFocusShortcut = typeof shortcuts?.focus === 'function';
  const handleShortcut = useEventCallback((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || !shortcuts?.focus?.(event)) return;
    const newest = findNewestToast(toastsRef.current);
    const target = newest ? containersRef.current.get(newest.id) : undefined;
    if (!target?.isConnected) return;
    event.preventDefault();
    const viewport = viewportRef.current;
    const active = target.ownerDocument.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== target.ownerDocument.body &&
      !viewport?.contains(active)
    ) {
      previousFocusRef.current = active;
    }
    target.focus({ preventScroll: false });
  });
  React.useEffect(() => {
    if (!hasFocusShortcut) return undefined;
    const listener = (event: KeyboardEvent) => handleShortcut(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [hasFocusShortcut, handleShortcut]);
```

and pass `registerContainer={registerContainer}` to every `<ToastContainer>`. In the `Toaster` docblock, add a keyboard bullet after the timers bullet:

```ts
 * - **Keyboard:** `shortcuts.focus` names a key press that moves focus to the newest toast (use a
 *   modifier, WCAG 2.1.4).
```

In `Toast.tsx`, add `ToasterShortcuts` to the `./Toaster` type re-export.

- [ ] **Step 4: Run the tests and quick checks**

Run: `npx vitest run src/components/feedback/__tests__ --reporter=default`
Expected: PASS (the 0.7 listener test filters by event type, so the absent `keydown` listener of a Toaster without `shortcuts` changes nothing).

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/feedback --max-warnings 0`
Expected: no errors.

Run: `npx vitest run src/__tests__/public-types.test.ts`
Expected: PASS (`ToasterShortcuts` is on `PENDING_PUBLIC_TYPES`).

- [ ] **Step 5: Commit**

```bash
git add src/components/feedback/Toaster.tsx src/components/feedback/Toast.tsx src/components/feedback/__tests__/Toaster.keyboard.test.tsx
git commit -m "feat(feedback): Toaster shortcut that focuses the newest toast"
```

---

### Task T12: Escape, Delete and Backspace in the toast region

**Files:**
- Modify: `src/components/feedback/Toaster.tsx`
- Test: `src/components/feedback/__tests__/Toaster.keyboard.test.tsx`

**Interfaces:**
- Consumes: `isOwnEvent`, `isEditableTarget` (`src/lib/events.ts`); `getOpenLayers()` and `LayerRecord.getAnchor()`/`.escape` (`src/lib/layers.ts`); `composeEventHandlers`; the focus origin (`previousFocusRef`) and `dismissAllToasts`.
- Produces: the viewport's `onKeyDown` = `composeEventHandlers(onKeyDown, handleEscape)` (the consumer's `onKeyDown` is destructured from the props); the container's `onKeyDown` handles Delete and Backspace.

- [ ] **Step 1: Write the failing tests**

In `Toaster.keyboard.test.tsx`, extend the imports:

```tsx
import { createPortal } from 'react-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Toast, Toaster } from '../Toast';
import { useDismiss } from '../../../hooks/useDismiss';
import { useModalLayer } from '../../../hooks/useModalLayer';
import { Portal } from '../../portal/Portal';
```

Append:

```tsx
/** A portaled element rendered from a toast (a stand-in for a Menu or Dialog opened from it). */
function PortaledAction() {
  return createPortal(<button type="button">Portaled action</button>, document.body);
}

/** An open, Escape-enabled dismiss layer anchored on a toast's button (a Tooltip stand-in). */
function AnchoredLayer({ onDismiss }: { onDismiss: () => void }) {
  const [open, setOpen] = React.useState(true);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const { layerId } = useDismiss({
    open,
    onDismiss: () => {
      onDismiss();
      setOpen(false);
    },
    refs: [surfaceRef, anchorRef],
    anchorRef,
    kind: 'tooltip',
  });
  return (
    <>
      <button ref={anchorRef} type="button">
        Details
      </button>
      {open ? (
        <Portal layerId={layerId}>
          <div ref={surfaceRef}>More about the upload</div>
        </Portal>
      ) : null}
    </>
  );
}

/** An open modal below the toasts (the useModalLayer harness of the Dialog and Menu tests). */
function StandInModal({ onDismiss }: { onDismiss: () => void }) {
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const attach = React.useCallback((el: HTMLDivElement | null) => {
    surfaceRef.current = el;
    setNode(el);
  }, []);
  const { layerId } = useModalLayer({ open: true, onDismiss, refs: [surfaceRef], container: node });
  return (
    <Portal layerId={layerId}>
      <div ref={attach} role="dialog" aria-label="Settings" tabIndex={-1}>
        <button type="button">Inside</button>
      </div>
    </Portal>
  );
}

const viewToast = (
  <Toast>
    <Toast.Title action={<button type="button">View</button>}>Saved</Toast.Title>
  </Toast>
);

describe('Escape (P3-03, D14)', () => {
  it('dismisses every toast and returns focus to the origin (entered by Tab)', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatchContent(viewToast, { timeout: 0 });
    dispatchContent(<p>Second</p>, { timeout: 0 });
    await user.click(input);
    await user.tab();
    expect(screen.getByRole('button', { name: 'View' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
    expect(input).toHaveFocus();
  });

  it('returns focus to the origin when focus entered by a click', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatchContent(viewToast, { timeout: 0 });
    await user.click(input);
    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
    expect(input).toHaveFocus();
  });

  it('returns focus to the origin when focus entered by the shortcut', async () => {
    const user = userEvent.setup();
    const { dispatch } = renderToaster(
      { shortcuts: { focus: altShiftN } },
      { app: <input aria-label="Name" /> },
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatch({ title: 'Saved', timeout: 0 });
    await user.click(input);
    await user.keyboard('{Alt>}{Shift>}N{/Shift}{/Alt}');
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
    expect(input).toHaveFocus();
  });

  it('leaves focus on the page body without an origin', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster();
    dispatchContent(viewToast, { timeout: 0 });
    act(() => screen.getByRole('button', { name: 'View' }).focus());
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
    expect(document.body).toHaveFocus();
  });

  it('does nothing when the consumer’s onKeyDown prevents it', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster({ onKeyDown: (event) => event.preventDefault() });
    dispatchContent(viewToast, { timeout: 0 });
    act(() => screen.getByRole('button', { name: 'View' }).focus());
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(1);
  });

  it('leaves an Escape pressed in a portal rendered from a toast alone', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title>Draft</Toast.Title>
        <Toast.Body>
          <PortaledAction />
        </Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    act(() => screen.getByRole('button', { name: 'Portaled action' }).focus());
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(1);
  });

  it('lets an open layer anchored in a toast take the first Escape; the next dismisses the toasts', async () => {
    const user = userEvent.setup();
    const onLayerDismiss = vi.fn();
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title action={<AnchoredLayer onDismiss={onLayerDismiss} />}>Upload done</Toast.Title>
      </Toast>,
      { timeout: 0 },
    );
    act(() => screen.getByRole('button', { name: 'Details' }).focus());
    await user.keyboard('{Escape}');
    expect(onLayerDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('More about the upload')).not.toBeInTheDocument();
    expect(getToasts()).toHaveLength(1);
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
  });

  it('leaves a modal below open (the key is prevented) and returns focus into it', async () => {
    const user = userEvent.setup();
    const onModalDismiss = vi.fn();
    const { dispatch } = renderToaster({}, { app: <StandInModal onDismiss={onModalDismiss} /> });
    dispatch({ title: 'Saved', timeout: 0 });
    const inside = screen.getByRole('button', { name: 'Inside' });
    act(() => inside.focus());
    await user.tab();
    expect(within(getToasts()[0]).getByRole('button', { name: 'Dismiss' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
    expect(onModalDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(inside).toHaveFocus();
  });
});

describe('Delete and Backspace (P3-03, D14)', () => {
  it('dismiss the focused toast and move focus to the next container', async () => {
    const user = userEvent.setup();
    const { dispatch } = renderToaster();
    dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    dispatch({ title: 'Third', timeout: 0 });
    const [first, second, third] = getToasts();
    act(() => first.focus());
    await user.keyboard('{Delete}');
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(second).toHaveFocus();
    await user.keyboard('{Backspace}');
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(third).toHaveFocus();
  });

  it('dismiss from a button inside the toast; focus goes to the next toast’s first control', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster();
    dispatchContent(viewToast, { timeout: 0 });
    dispatchContent(
      <Toast>
        <Toast.Title>Second</Toast.Title>
      </Toast>,
      { timeout: 0 },
    );
    act(() => screen.getByRole('button', { name: 'View' }).focus());
    await user.keyboard('{Delete}');
    expect(getToasts()).toHaveLength(1);
    expect(within(getToasts()[0]).getByRole('button', { name: 'Dismiss' })).toHaveFocus();
  });

  it('edit a field inside a toast instead of dismissing it', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title>Reply</Toast.Title>
        <Toast.Body>
          <input aria-label="Message" defaultValue="Hi!" />
        </Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    const field = screen.getByRole('textbox', { name: 'Message' });
    await user.type(field, '{Backspace}');
    expect(field).toHaveValue('Hi');
    expect(getToasts()).toHaveLength(1);
  });

  it('keep the toast for a key pressed in a portal rendered from it', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title>Draft</Toast.Title>
        <Toast.Body>
          <PortaledAction />
        </Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    act(() => screen.getByRole('button', { name: 'Portaled action' }).focus());
    await user.keyboard('{Delete}');
    expect(getToasts()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/Toaster.keyboard.test.tsx -t "Escape|Delete"`
Expected: FAIL — Escape and Delete leave the toasts shown.

- [ ] **Step 3: Implement the keys in `Toaster.tsx`**

Add `import { composeEventHandlers } from '../../lib/composeEventHandlers';` and `import { isEditableTarget, isOwnEvent } from '../../lib/events';`.

In `ToastContainer`, before `if (!isMounted) return null;`, add:

```tsx
  // Delete or Backspace on the container or inside it dismisses the toast (D14; Backspace is the
  // delete key of Mac keyboards), except in an editable field and for a key pressed in a portal
  // opened from the toast (its target is outside the container).
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    if (event.defaultPrevented || !isOwnEvent(event) || isEditableTarget(event.target)) return;
    event.preventDefault();
    onDismiss(id);
  };
```

and add `onKeyDown={handleKeyDown}` to the container element (after `onBlur`).

In `Toaster`, destructure `onKeyDown` from the props (next to `onFocus` and `onBlur`) and add after `forgetFocusOrigin`:

```tsx
  // Escape in the toast region (D14) dismisses every toast and returns focus to where it was
  // before focus entered the toasts. Left alone: a key pressed in a portal opened from a toast
  // (its target is outside the viewport; the portal's own widget handles it) and one that an open
  // Escape-enabled layer anchored in the viewport takes first (a Tooltip on a toast's button, a
  // Menu opened from a toast). Prevented, so the dismiss-layer stack does not route it to a Dialog
  // or Drawer below (the region counts as inside every layer).
  const handleEscape = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' && event.key !== 'Esc') return;
    if (event.defaultPrevented || event.nativeEvent.isComposing || !isOwnEvent(event)) return;
    const viewport = event.currentTarget;
    if (getOpenLayers().some((layer) => layer.escape && viewport.contains(layer.getAnchor()))) {
      return;
    }
    event.preventDefault();
    const origin = previousFocusRef.current;
    previousFocusRef.current = null;
    if (origin?.isConnected) origin.focus({ preventScroll: true });
    dismissAllToasts();
  };
```

and add `onKeyDown={composeEventHandlers(onKeyDown, handleEscape)}` to the viewport element (after `onBlur`). In the `Toaster` docblock, extend the keyboard bullet:

```ts
 * - **Keyboard:** `shortcuts.focus` names a key press that moves focus to the newest toast (use a
 *   modifier, WCAG 2.1.4); Escape in the toast region dismisses every toast and returns focus to
 *   where it was before focus entered the toasts (a tooltip or menu of a toast closes first, and a
 *   Dialog below stays open); Delete or Backspace dismisses the focused toast.
```

- [ ] **Step 4: Run the tests and quick checks**

Run: `npx vitest run src/components/feedback/__tests__ --reporter=default`
Expected: PASS.

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/feedback --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/Toaster.tsx"`
Expected: no errors; PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/feedback/Toaster.tsx src/components/feedback/__tests__/Toaster.keyboard.test.tsx
git commit -m "feat(feedback): Escape, Delete and Backspace in the toast region"
```

---
### Task T13: Region-wide pausing, and a focus origin that survives layers opened from a toast

**Files:**
- Modify: `src/components/feedback/Toaster.tsx`, `src/components/feedback/__tests__/Toast.test.tsx` (the "pauses only the hovered toast" case, spec §6.4)
- Test: `src/components/feedback/__tests__/Toaster.keyboard.test.tsx`

**Interfaces:**
- Consumes: `getOpenLayers`, `isInsideLayerTree` (`src/lib/layers.ts`); `isConnectedAndFocusable` (`src/lib/focus.ts`).
- Produces: `ToastTimers.setPaused(reason: 'hover' | 'focus', paused: boolean)` replaces the per-toast `pause`/`resume`; module helper `isInToastRegion(viewport: HTMLElement, node: Node): boolean`; the viewport's `onPointerEnter`/`onPointerLeave`/`onFocus`/`onBlur` pause every toast (the consumer's handlers run first, bookkeeping always runs); the container has no pause handlers any more.

- [ ] **Step 1: Write the failing tests**

In `Toaster.keyboard.test.tsx` append:

```tsx
/** A layer opened from a toast's button, in a portal (a Menu stand-in): focus moves in and back. */
function MenuStandIn() {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const { layerId } = useDismiss({
    open,
    onDismiss: close,
    refs: [surfaceRef, buttonRef],
    anchorRef: buttonRef,
    kind: 'menu',
  });
  React.useLayoutEffect(() => {
    if (open) surfaceRef.current?.querySelector('button')?.focus();
  }, [open]);
  return (
    <>
      <button ref={buttonRef} type="button" onClick={() => setOpen(true)}>
        More
      </button>
      {open ? (
        <Portal layerId={layerId}>
          <div ref={surfaceRef} role="group" aria-label="More actions">
            <button type="button" onClick={close}>
              Archive
            </button>
          </div>
        </Portal>
      ) : null}
    </>
  );
}

describe('region-wide pausing (P3-03, D14)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pauses every toast while the pointer is over one, and resumes when it leaves the region', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Hovered' });
    dispatch({ title: 'Other' });
    fireEvent.pointerOver(getToasts()[0]);
    advance(20_000);
    expect(getToasts()).toHaveLength(2);
    fireEvent.pointerOut(getToasts()[0], { relatedTarget: document.body });
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });

  it('pauses every toast while focus is in one, and resumes when focus leaves the region', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Focused' });
    dispatch({ title: 'Other' });
    const button = within(getToasts()[0]).getByRole('button', { name: 'Dismiss' });
    act(() => button.focus());
    advance(20_000);
    expect(getToasts()).toHaveLength(2);
    act(() => button.blur());
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });

  it('keeps the timers paused and the return target while focus is in a layer opened from a toast', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { dispatchContent } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatchContent(
      <Toast>
        <Toast.Title action={<MenuStandIn />}>Saved</Toast.Title>
      </Toast>,
      { timeout: 3000 },
    );
    await user.click(input);
    await user.tab();
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveFocus();
    advance(10_000);
    expect(getToasts()).toHaveLength(1);
    // The layer takes the first Escape and puts focus back on its button.
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
    expect(getToasts()).toHaveLength(1);
    // The origin survived the trip through the portal.
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
    expect(input).toHaveFocus();
  });
});
```

In `Toast.test.tsx` (spec §6.4) replace the case `'pauses only the hovered toast'` with:

```tsx
  it('pauses every toast while the pointer is over one of them (the region, D14)', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Hovered' });
    dispatch({ title: 'Other' });
    fireEvent.pointerOver(getToasts()[0]);
    advance(5000);
    expect(screen.getByText('Hovered')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    fireEvent.pointerOut(getToasts()[0], { relatedTarget: document.body });
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/Toaster.keyboard.test.tsx -t "region-wide"`
Expected: FAIL — the other toast expires while one is hovered or focused, and the toast with the stand-in menu expires while focus is in the menu.

Run: `npx vitest run src/components/feedback/__tests__/Toast.test.tsx -t "pauses every toast while the pointer is over one of them"`
Expected: FAIL — `Other` is gone after 5000 ms.

- [ ] **Step 3: One pause for the region in the timers**

Replace `ToastTimers` and `createToastTimers` in `Toaster.tsx`:

```ts
/**
 * Auto-dismiss timers of one Toaster. A timer runs only while neither the pointer nor focus is in
 * the toast region (D14), the window is in the foreground and the Toaster is mounted; otherwise it
 * is suspended and keeps its remaining time. Every method is called from event handlers or
 * effects, never during render.
 */
interface ToastTimers {
  /**
   * Starts the timer of the shown toast `id` for its dispatch `seq`, once: a call with the `seq`
   * already started does nothing, a new `seq` (the toast was replaced) restarts it. A timeout that
   * is not a positive finite number means none. A toast replaced while the region is paused stays
   * paused.
   */
  start(id: string, seq: number, timeout: number): void;
  /** Cancels the timer of `id`. */
  remove(id: string): void;
  /** Cancels every timer; the region's pause is kept. */
  clear(): void;
  /** `true` while the pointer (`'hover'`) or focus (`'focus'`) is in the toast region. */
  setPaused(reason: PauseReason, paused: boolean): void;
  /** `true` while the window has lost focus or the page is not shown (a background tab). */
  setInBackground(inBackground: boolean): void;
  /** `true` while the Toaster is unmounted (including StrictMode's simulated unmount). */
  setSuspended(suspended: boolean): void;
}

function createToastTimers(onExpire: (id: string) => void): ToastTimers {
  const timers = new Map<string, RunningTimer>();
  /** Why the region pauses every timer. */
  const pauses = new Set<PauseReason>();
  /** The dispatch (`seq`) whose timer was started last, per toast. */
  const started = new Map<string, number>();
  let inBackground = false;
  let suspended = false;

  const sync = (id: string) => {
    const timer = timers.get(id);
    if (!timer) return;
    const canRun = !suspended && !inBackground && pauses.size === 0;
    if (canRun && timer.handle === null) {
      timer.startedAt = Date.now();
      timer.handle = setTimeout(() => {
        timers.delete(id);
        started.delete(id);
        onExpire(id);
      }, timer.remaining);
    } else if (!canRun && timer.handle !== null) {
      clearTimeout(timer.handle);
      timer.handle = null;
      timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
    }
  };
  const syncAll = () => {
    for (const id of Array.from(timers.keys())) sync(id);
  };
  const stop = (id: string) => {
    const timer = timers.get(id);
    if (timer?.handle != null) clearTimeout(timer.handle);
    timers.delete(id);
  };

  return {
    start(id, seq, timeout) {
      if (started.get(id) === seq) return;
      started.set(id, seq);
      stop(id);
      if (!(timeout > 0) || !Number.isFinite(timeout)) return;
      timers.set(id, { handle: null, remaining: timeout, startedAt: 0 });
      sync(id);
    },
    remove(id) {
      stop(id);
      started.delete(id);
    },
    clear() {
      for (const id of Array.from(timers.keys())) stop(id);
      started.clear();
    },
    setPaused(reason, paused) {
      if (paused) pauses.add(reason);
      else pauses.delete(reason);
      syncAll();
    },
    setInBackground(value) {
      inBackground = value;
      syncAll();
    },
    setSuspended(value) {
      suspended = value;
      syncAll();
    },
  };
}
```

- [ ] **Step 4: The region, the viewport handlers and the focus origin**

Add `isInsideLayerTree` to the `lib/layers` import and `isConnectedAndFocusable` to the `lib/focus` import. After `findNewestToast`, add:

```ts
/**
 * Whether `node` is in the toast region: inside the viewport, or inside an open dismiss layer
 * anchored inside it (a Menu, Popover or Tooltip opened from a toast, whose portal lives elsewhere
 * in the document).
 */
function isInToastRegion(viewport: HTMLElement, node: Node): boolean {
  if (viewport.contains(node)) return true;
  return getOpenLayers().some((layer) => {
    const anchor = layer.getAnchor();
    return anchor !== null && viewport.contains(anchor) && isInsideLayerTree(layer.id, node);
  });
}
```

In `ToastContainer`, delete the `onPointerEnter`, `onPointerLeave`, `onFocus` and `onBlur` attributes (the viewport pauses now).

In `Toaster`, destructure `onPointerEnter` and `onPointerLeave` from the props (next to `onFocus`, `onBlur` and `onKeyDown`), replace `rememberFocusOrigin` and `forgetFocusOrigin`:

```tsx
  // Focus entering the toast region from an element outside it: return there when the focused
  // toast goes and after Escape. Focus arriving with no related target keeps what is remembered
  // (the Toaster's own move to the next toast, the window regaining focus). Moves inside the region
  // — a layer opened from a toast included — change nothing, and an element that cannot take focus
  // (inside a closing, inert surface) is never remembered.
  const rememberFocusOrigin = (event: React.FocusEvent<HTMLDivElement>) => {
    const from = event.relatedTarget;
    if (!(from instanceof HTMLElement) || !isConnectedAndFocusable(from)) return;
    if (isInToastRegion(event.currentTarget, from)) return;
    previousFocusRef.current = from;
  };

  // Focus leaving the region for another element or for `<body>` forgets the element, so a toast
  // focused again later from nowhere never sends focus back to something focused long before.
  // Kept: moves inside the region (a layer opened from a toast included), a removed or dismissed
  // toast (its node is gone or inert; the Toaster moves focus itself) and the window losing focus
  // (the element keeps document focus while another window is active).
  const forgetFocusOrigin = (event: React.FocusEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const to = event.relatedTarget;
    if (to instanceof Node && isInToastRegion(viewport, to)) return;
    // A blur from inside a dismissed (exiting, inert) toast: the Toaster has moved focus itself,
    // or a browser's focus fix-up blurs the inert subtree later.
    if (event.target.closest('[data-wave-toast][data-presence="exiting"]')) return;
    if (to === null) {
      const from = event.target;
      if (!from.isConnected) return;
      const active = from.ownerDocument.activeElement;
      if (active && viewport.contains(active)) return;
    }
    previousFocusRef.current = null;
  };
```

in `handleShortcut` replace `!viewport?.contains(active)` with `!(viewport && isInToastRegion(viewport, active))`, and replace the viewport's `onFocus` and `onBlur` and add the pointer handlers:

```tsx
          onFocus={(event) => {
            // Bookkeeping always runs (a consumer's preventDefault() cannot cancel a focus change).
            // Focus in a portal opened from a toast arrives here too (React bubbles focus events
            // through portals) and counts as focus in the region (D14).
            onFocus?.(event);
            rememberFocusOrigin(event);
            timers.setPaused('focus', true);
          }}
          onBlur={(event) => {
            onBlur?.(event);
            forgetFocusOrigin(event);
            const next = event.relatedTarget;
            if (next instanceof Node && isInToastRegion(event.currentTarget, next)) return;
            timers.setPaused('focus', false);
          }}
          onPointerEnter={(event) => {
            onPointerEnter?.(event);
            timers.setPaused('hover', true);
          }}
          onPointerLeave={(event) => {
            onPointerLeave?.(event);
            timers.setPaused('hover', false);
          }}
```

Update the docs. `ToastOptions.timeout`:

```ts
  /**
   * Auto-dismiss timeout in milliseconds. The countdown starts when the toast is shown (a toast
   * waiting beyond the Toaster's `limit` does not count down) and pauses while the pointer or
   * focus is anywhere in the toast region (a menu or popover opened from a toast included) and
   * while the browser window is in the background (it has lost focus, or the page is not shown, as
   * in a background tab, also when the Toaster mounts there). `0` (or any value that is not a
   * positive finite number) keeps the toast until it is dismissed.
   * @default 5000
   */
  timeout?: number;
```

In the `Toaster` docblock, replace the timers bullet:

```ts
 * - Timers pause while the pointer or focus is anywhere in the toast region, a menu or popover
 *   opened from a toast included (someone reading or operating one toast is reading the stack),
 *   and while the window is in the background (it has lost focus, or the page is not shown, as in
 *   a background tab). When a toast that contains focus goes away, focus moves to the next toast
 *   (or the previous one), or back to the element that was focused before focus entered the
 *   toasts once no toast is left.
```

- [ ] **Step 5: Run the tests and quick checks**

Run: `npx vitest run src/components/feedback/__tests__ src/__tests__/integration.test.tsx --reporter=default`
Expected: PASS: the 0.7 hover and focus pause cases still pause the toast they touch (the events reach the viewport), and "a replaced toast keeps its pause" still holds (the region's pause survives a replacement).

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/components/feedback --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/Toaster.tsx"`
Expected: no errors; PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/feedback/Toaster.tsx src/components/feedback/__tests__/Toaster.keyboard.test.tsx src/components/feedback/__tests__/Toast.test.tsx
git commit -m "feat(feedback): every toast pauses while the pointer or focus is in the toast region"
```

---

### Task T14: `createToaster()` and `<Toaster toaster>` (P3-08)

**Files:**
- Create: `src/lib/__tests__/toaster.server.test.tsx`, `src/components/feedback/__tests__/Toaster.handle.test.tsx`
- Modify: `src/lib/toaster.ts`, `src/components/feedback/Toaster.tsx`
- Test: `src/lib/__tests__/toaster.test.ts`

**Interfaces:**
- Consumes: `isToastOptions` (T7); the Toaster's memoised `controller` (stable across renders).
- Produces (`src/lib/toaster.ts`):
  - `export interface ToasterHandle extends ToastController {}` (public; exported from the entry by Task I1);
  - `export function createToaster(): ToasterHandle` (public);
  - `export type ToasterHandleBinding = { status: 'bound'; unbind: () => void } | { status: 'taken' } | { status: 'unknown' }` and `export function bindToasterHandle(handle: ToastController, owner: object, controller: ToastController): ToasterHandleBinding` (internal: not for the entry).
  - `ToasterProps['toaster']?: ToasterHandle`; warnings `Toaster:handle-bound` (spec) and `Toaster:handle-unknown` (an object `createToaster()` did not make).

- [ ] **Step 1: Write the failing tests**

Change the imports of `src/lib/__tests__/toaster.test.ts` to

```ts
import * as React from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import { bindToasterHandle, createToaster, isToastOptions } from '../toaster';
```

and append:

```ts
/** A controller whose calls the test reads (its parameters are wide, so it is a ToastController). */
function fakeController() {
  return {
    dispatchToast: vi.fn<(first: unknown, second?: unknown) => string>(() => ''),
    dismissToast: vi.fn<(id: string) => void>(),
    dismissAllToasts: vi.fn<() => void>(),
  };
}

describe('createToaster (P3-08, toaster-5)', () => {
  it('returns ids at once, generated or given, unique across handles', () => {
    const first = createToaster();
    const second = createToaster();
    const ids = [
      first.dispatchToast({ title: 'One' }),
      first.dispatchToast(React.createElement('span', null, 'Two')),
      second.dispatchToast({ title: 'Three' }),
    ];
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id !== '')).toBe(true);
    expect(first.dispatchToast({ toastId: 'given', title: 'Four' })).toBe('given');
  });

  it('queues dispatches until a Toaster binds, then replays them in order with their ids', () => {
    const handle = createToaster();
    const element = React.createElement('span', null, 'Two');
    const one = handle.dispatchToast({ title: 'One' });
    const two = handle.dispatchToast(element, { timeout: 0 });
    const controller = fakeController();
    expect(bindToasterHandle(handle, {}, controller).status).toBe('bound');
    expect(controller.dispatchToast.mock.calls).toEqual([
      [{ title: 'One', toastId: one }],
      [element, { timeout: 0, toastId: two }],
    ]);
  });

  it('replaces a waiting dispatch with the same id in place', () => {
    const handle = createToaster();
    handle.dispatchToast({ toastId: 'sync', title: 'Syncing…' });
    handle.dispatchToast({ title: 'Other' });
    handle.dispatchToast({ toastId: 'sync', title: 'Synced' });
    const controller = fakeController();
    bindToasterHandle(handle, {}, controller);
    expect(controller.dispatchToast.mock.calls.map(([options]) => (options as { title: string }).title)).toEqual([
      'Synced',
      'Other',
    ]);
  });

  it('removes a waiting toast with dismissToast, and every waiting toast with dismissAllToasts', () => {
    const handle = createToaster();
    const one = handle.dispatchToast({ title: 'One' });
    handle.dispatchToast({ title: 'Two' });
    handle.dismissToast(one);
    const controller = fakeController();
    bindToasterHandle(handle, {}, controller);
    expect(controller.dispatchToast).toHaveBeenCalledTimes(1);

    const other = createToaster();
    other.dispatchToast({ title: 'Three' });
    other.dismissAllToasts();
    const otherController = fakeController();
    bindToasterHandle(other, {}, otherController);
    expect(otherController.dispatchToast).not.toHaveBeenCalled();
  });

  it('forwards to the bound controller at once', () => {
    const handle = createToaster();
    const controller = fakeController();
    bindToasterHandle(handle, {}, controller);
    const id = handle.dispatchToast({ title: 'Now' });
    handle.dismissToast(id);
    handle.dismissAllToasts();
    expect(controller.dispatchToast.mock.calls).toEqual([[{ title: 'Now', toastId: id }]]);
    expect(controller.dismissToast.mock.calls).toEqual([[id]]);
    expect(controller.dismissAllToasts).toHaveBeenCalledTimes(1);
  });

  it('is not taken over by a second owner; unbound, it queues again for the next owner', () => {
    const handle = createToaster();
    const first = fakeController();
    const binding = bindToasterHandle(handle, {}, first);
    expect(bindToasterHandle(handle, {}, fakeController())).toEqual({ status: 'taken' });
    if (binding.status === 'bound') binding.unbind();
    handle.dispatchToast({ title: 'Waiting' });
    expect(first.dispatchToast).not.toHaveBeenCalled();
    const next = fakeController();
    expect(bindToasterHandle(handle, {}, next).status).toBe('bound');
    expect(next.dispatchToast).toHaveBeenCalledTimes(1);
  });

  it('takes the queue once when the same owner binds again (StrictMode)', () => {
    const handle = createToaster();
    const owner = {};
    handle.dispatchToast({ title: 'Once' });
    const controller = fakeController();
    const first = bindToasterHandle(handle, owner, controller);
    if (first.status === 'bound') first.unbind();
    bindToasterHandle(handle, owner, controller);
    expect(controller.dispatchToast).toHaveBeenCalledTimes(1);
  });

  it('reports an object that createToaster did not make as unknown', () => {
    expect(bindToasterHandle(fakeController(), {}, fakeController())).toEqual({ status: 'unknown' });
  });
});
```

Create `src/lib/__tests__/toaster.server.test.tsx`:

```tsx
// @vitest-environment node
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Toast } from '../../components/feedback/Toast';
import { Toaster } from '../../components/feedback/Toaster';
import { bindToasterHandle, createToaster } from '../toaster';

/** A module-scope handle, as an app creates it next to its query client. */
const appToaster = createToaster();

describe('createToaster on the server (P3-08, D33)', () => {
  it('returns an id for a dispatch and queues nothing', () => {
    expect(typeof window).toBe('undefined');
    expect(appToaster.dispatchToast({ title: 'Saved' })).not.toBe('');
    expect(appToaster.dispatchToast({ toastId: 'given', title: 'Saved' })).toBe('given');
    const controller = {
      dispatchToast: vi.fn<(first: unknown, second?: unknown) => string>(() => ''),
      dismissToast: vi.fn<(id: string) => void>(),
      dismissAllToasts: vi.fn<() => void>(),
    };
    const binding = bindToasterHandle(appToaster, {}, controller);
    expect(binding.status).toBe('bound');
    expect(controller.dispatchToast).not.toHaveBeenCalled();
    if (binding.status === 'bound') binding.unbind();
  });

  it('renders a page with a bound Toaster and no toast', () => {
    appToaster.dispatchToast(
      <Toast>
        <Toast.Title>Not on the server</Toast.Title>
      </Toast>,
    );
    const html = renderToString(
      <Toaster toaster={appToaster}>
        <main>App</main>
      </Toaster>,
    );
    expect(html).toContain('<main>App</main>');
    expect(html).not.toContain('data-wave-toast');
    expect(html).not.toContain('Not on the server');
  });
});
```

Create `src/components/feedback/__tests__/Toaster.handle.test.tsx`:

```tsx
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast, Toaster, useToastController } from '../Toast';
import type { ToastController, ToasterProps } from '../Toast';
import { createToaster } from '../../../lib/toaster';
import type { ToasterHandle } from '../../../lib/toaster';
import { useDismiss } from '../../../hooks/useDismiss';
import { useModalIsolation } from '../../../hooks/useModalIsolation';
import { Portal } from '../../portal/Portal';
import { advance, getLiveRegion, getToasts, getViewport } from './toasterHarness';

const texts = () => getToasts().map((toast) => toast.textContent);

describe('createToaster with a Toaster (P3-08, toaster-5)', () => {
  describe('timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows, announces once, times and pauses a toast dispatched from a plain function', () => {
      const handle = createToaster();
      /** A plain function, no hook: what a query-cache callback does. */
      const notifySaved = () => handle.dispatchToast({ status: 'success', title: 'Saved' });
      render(
        <Toaster toaster={handle}>
          <p>App</p>
        </Toaster>,
      );
      act(() => {
        notifySaved();
      });
      expect(getToasts()).toHaveLength(1);
      expect(getLiveRegion('polite').textContent).toBe('Success: Saved');
      expect(getLiveRegion('polite').childElementCount).toBe(1);
      // Paused on hover…
      fireEvent.pointerOver(getToasts()[0]);
      advance(20_000);
      expect(getToasts()).toHaveLength(1);
      fireEvent.pointerOut(getToasts()[0], { relatedTarget: document.body });
      // …and on focus.
      const dismissButton = within(getToasts()[0]).getByRole('button', { name: 'Dismiss' });
      act(() => dismissButton.focus());
      advance(20_000);
      expect(getToasts()).toHaveLength(1);
      act(() => dismissButton.blur());
      advance(4999);
      expect(getToasts()).toHaveLength(1);
      advance(1);
      expect(getToasts()).toHaveLength(0);
    });
  });

  it('dismisses a toast through the handle', () => {
    const handle = createToaster();
    render(<Toaster toaster={handle} />);
    let id = '';
    act(() => {
      id = handle.dispatchToast(
        <Toast>
          <Toast.Title>Uploading</Toast.Title>
        </Toast>,
        { timeout: 0 },
      );
    });
    expect(getToasts()).toHaveLength(1);
    act(() => handle.dismissToast(id));
    expect(getToasts()).toHaveLength(0);
  });

  it('shows dispatches made before a Toaster binds, in order', () => {
    const handle = createToaster();
    handle.dispatchToast({ title: 'First', timeout: 0 });
    handle.dispatchToast(<p>Second</p>, { timeout: 0 });
    render(<Toaster toaster={handle} />);
    expect(texts()).toEqual(['Info: First', 'Info: Second']);
  });

  it('drops waiting toasts dismissed through the handle', () => {
    const handle = createToaster();
    const first = handle.dispatchToast({ title: 'First', timeout: 0 });
    handle.dispatchToast({ title: 'Second', timeout: 0 });
    handle.dismissToast(first);
    const { unmount } = render(<Toaster toaster={handle} />);
    expect(texts()).toEqual(['Info: Second']);
    unmount();

    const other = createToaster();
    other.dispatchToast({ title: 'Third', timeout: 0 });
    other.dismissAllToasts();
    render(<Toaster toaster={other} />);
    expect(getToasts()).toHaveLength(0);
  });

  it('keeps two handles bound to two Toasters independent (region, position, limit)', () => {
    const app = createToaster();
    const chat = createToaster();
    render(
      <>
        <Toaster toaster={app} aria-label="App notifications" position="top-end" limit={1} />
        <Toaster toaster={chat} aria-label="Chat notifications" position="bottom-start" />
      </>,
    );
    act(() => {
      app.dispatchToast({ title: 'App one', timeout: 0 });
      app.dispatchToast({ title: 'App two', timeout: 0 });
      chat.dispatchToast({ title: 'Chat one', timeout: 0 });
    });
    const appRegion = screen.getByRole('region', { name: 'App notifications' });
    const chatRegion = screen.getByRole('region', { name: 'Chat notifications' });
    expect(appRegion).toHaveAttribute('data-position', 'top-end');
    expect(within(appRegion).getByText('App one')).toBeInTheDocument();
    expect(within(appRegion).queryByText('App two')).not.toBeInTheDocument();
    expect(within(chatRegion).getByText('Chat one')).toBeInTheDocument();
    expect(within(chatRegion).queryByText('App one')).not.toBeInTheDocument();
  });

  it('unbinds when its Toaster unmounts; the next dispatch waits for a new Toaster', () => {
    const handle = createToaster();
    const first = render(<Toaster toaster={handle} />);
    first.unmount();
    handle.dispatchToast({ title: 'Later', timeout: 0 });
    render(<Toaster toaster={handle} />);
    expect(texts()).toEqual(['Info: Later']);
  });

  it('binds once under StrictMode and duplicates nothing', () => {
    const handle = createToaster();
    handle.dispatchToast({ title: 'Queued', timeout: 0 });
    render(
      <React.StrictMode>
        <Toaster toaster={handle} />
      </React.StrictMode>,
    );
    act(() => {
      handle.dispatchToast({ title: 'Live', timeout: 0 });
    });
    expect(texts()).toEqual(['Info: Queued', 'Info: Live']);
  });

  it('warns and does not bind a second Toaster to a bound handle', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = createToaster();
    render(
      <>
        <Toaster toaster={handle} aria-label="First notifications" />
        <Toaster toaster={handle} aria-label="Second notifications" />
      </>,
    );
    act(() => {
      handle.dispatchToast({ title: 'Saved', timeout: 0 });
    });
    const firstRegion = screen.getByRole('region', { name: 'First notifications' });
    const secondRegion = screen.getByRole('region', { name: 'Second notifications' });
    expect(within(firstRegion).getByText('Saved')).toBeInTheDocument();
    expect(within(secondRegion).queryByText('Saved')).not.toBeInTheDocument();
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Toaster: this handle is already bound to another Toaster; a handle binds one Toaster. Create one handle per Toaster.',
      ],
    ]);
    warn.mockRestore();
  });

  it('warns when `toaster` is not a handle from createToaster()', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function Nested() {
      const controller = useToastController();
      return <Toaster toaster={controller} aria-label="Nested notifications" />;
    }
    render(
      <Toaster>
        <Nested />
      </Toaster>,
    );
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Toaster: `toaster` is not a handle from createToaster(), so nothing is bound. Pass the value createToaster() returns.',
      ],
    ]);
    warn.mockRestore();
  });

  it('renders a handle’s toast in the Toaster’s React tree (context from above the Toaster)', () => {
    const RouteContext = React.createContext('none');
    function CurrentRoute() {
      return <>{React.useContext(RouteContext)}</>;
    }
    const handle = createToaster();
    render(
      <RouteContext.Provider value="/settings">
        <Toaster toaster={handle} />
      </RouteContext.Provider>,
    );
    act(() => {
      handle.dispatchToast(
        <Toast>
          <Toast.Title>
            Saved on <CurrentRoute />
          </Toast.Title>
        </Toast>,
        { timeout: 0 },
      );
    });
    expect(getToasts()[0]).toHaveTextContent('Saved on /settings');
  });

  it('keeps a handle’s toast reachable by Tab over a modal', async () => {
    function StandInModal() {
      const [surface, setSurface] = React.useState<HTMLElement | null>(null);
      useModalIsolation(surface !== null, { layerId: 'stand-in-modal', container: surface });
      return (
        <Portal>
          <div ref={setSurface} role="dialog" aria-label="Stand-in">
            <button type="button">Inside</button>
          </div>
        </Portal>
      );
    }
    const user = userEvent.setup();
    const handle = createToaster();
    render(
      <Toaster toaster={handle}>
        <StandInModal />
      </Toaster>,
    );
    act(() => {
      handle.dispatchToast({ title: 'Over the modal', timeout: 0 });
    });
    act(() => screen.getByRole('button', { name: 'Inside' }).focus());
    await user.tab();
    expect(within(getViewport()).getByRole('button', { name: 'Dismiss' })).toHaveFocus();
  });

  it('moves a handle’s toasts beside an open panel at their edge', () => {
    // jsdom's window is 1024 × 768 without layout: the stand-in panel reports a stubbed box.
    function StandInPanel() {
      const surfaceRef = React.useRef<HTMLElement | null>(null);
      const { layerId } = useDismiss({
        open: true,
        onDismiss: () => {},
        refs: [surfaceRef],
        kind: 'modal',
      });
      const attach = React.useCallback((el: HTMLDivElement | null) => {
        surfaceRef.current = el;
        if (el) {
          el.getBoundingClientRect = () =>
            ({ left: 704, right: 1024, top: 0, bottom: 768, width: 320, height: 768, x: 704, y: 0, toJSON: () => ({}) }) as DOMRect;
        }
      }, []);
      return (
        <Portal layerId={layerId}>
          <div ref={attach} role="dialog" aria-label="Filters">
            <button type="button">Apply</button>
          </div>
        </Portal>
      );
    }
    const handle = createToaster();
    render(
      <Toaster toaster={handle}>
        <StandInPanel />
      </Toaster>,
    );
    act(() => {
      handle.dispatchToast({ title: 'Filters saved', timeout: 0 });
    });
    expect(getViewport().style.getPropertyValue('--wave-toaster-offset')).toBe('320px');
  });

  it('types the handle as the controller and the toaster prop', () => {
    expectTypeOf<ToasterHandle>().toExtend<ToastController>();
    expectTypeOf(createToaster).returns.toEqualTypeOf<ToasterHandle>();
    expectTypeOf<ToasterProps['toaster']>().toEqualTypeOf<ToasterHandle | undefined>();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/toaster.test.ts src/lib/__tests__/toaster.server.test.tsx src/components/feedback/__tests__/Toaster.handle.test.tsx`
Expected: FAIL — `createToaster` and `bindToasterHandle` are not exported by `../toaster`.

- [ ] **Step 3: The handle in `src/lib/toaster.ts`**

Replace the file's imports with

```ts
import type * as React from 'react';
import type {
  ToastController,
  ToastDispatchOptions,
  ToastOptions,
} from '../components/feedback/Toaster';
```

and append after `isToastOptions`:

```ts
/**
 * A toast controller that code outside React components can call (a query-cache callback, a
 * server-event handler, a shared helper). Bind it to one Toaster with `<Toaster toaster={handle}>`;
 * toasts dispatched through it render there. One handle per Toaster is also how an app runs
 * several Toasters (Fluent's `toasterId`).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the handle is its own named public type (spec D33); its binding stays internal
export interface ToasterHandle extends ToastController {}

/** A dispatch waiting for a Toaster to bind the handle. */
interface QueuedDispatch {
  id: string;
  run: (controller: ToastController) => void;
}

/** The internal state of a handle, never reachable from the handle itself. */
interface HandleState {
  controller: ToastController | null;
  /** The Toaster the handle is bound to (an identity token), or `null`. */
  owner: object | null;
  queue: QueuedDispatch[];
}

const handleStates = new WeakMap<object, HandleState>();
let handleCount = 0;

/**
 * Creates a handle. It touches no DOM, so a module-scope handle is safe during server rendering;
 * a dispatch on the server does nothing (it returns the id), so no toast is carried from one
 * request to the next.
 *
 * - `dispatchToast` returns the id at once: `toastId`, or one the handle generates.
 * - Before a Toaster binds the handle, dispatches wait in its queue, in dispatch order (a dispatch
 *   with the id of a waiting one replaces it in place); `dismissToast` removes a waiting toast and
 *   `dismissAllToasts` empties the queue. The Toaster that binds takes the queue.
 *
 * @example
 * export const appToaster = createToaster();
 * // <Toaster toaster={appToaster}><App /></Toaster>
 * queryClient.getMutationCache().config.onError = () => {
 *   appToaster.dispatchToast({ status: 'error', title: 'Could not save' });
 * };
 */
export function createToaster(): ToasterHandle {
  handleCount += 1;
  const prefix = `wave-toaster-h${handleCount}`;
  let dispatchCount = 0;
  const state: HandleState = { controller: null, owner: null, queue: [] };
  const nextId = () => {
    dispatchCount += 1;
    return `${prefix}-${dispatchCount}`;
  };
  const send = (id: string, run: (controller: ToastController) => void): string => {
    if (typeof window === 'undefined') return id;
    if (state.controller) {
      run(state.controller);
      return id;
    }
    const index = state.queue.findIndex((call) => call.id === id);
    if (index === -1) state.queue.push({ id, run });
    else state.queue[index] = { id, run };
    return id;
  };

  function dispatchToast(content: React.ReactNode, options?: ToastDispatchOptions): string;
  function dispatchToast(options: ToastOptions): string;
  function dispatchToast(
    first: React.ReactNode | ToastOptions,
    second?: ToastDispatchOptions,
  ): string {
    if (isToastOptions(first)) {
      const id = first.toastId ?? nextId();
      const options: ToastOptions = { ...first, toastId: id };
      return send(id, (controller) => {
        controller.dispatchToast(options);
      });
    }
    const id = second?.toastId ?? nextId();
    const options: ToastDispatchOptions = { ...second, toastId: id };
    return send(id, (controller) => {
      controller.dispatchToast(first, options);
    });
  }

  const handle: ToasterHandle = {
    dispatchToast,
    dismissToast(id) {
      if (state.controller) state.controller.dismissToast(id);
      else state.queue = state.queue.filter((call) => call.id !== id);
    },
    dismissAllToasts() {
      if (state.controller) state.controller.dismissAllToasts();
      else state.queue = [];
    },
  };
  handleStates.set(handle, state);
  return handle;
}

/** The result of {@link bindToasterHandle}. */
export type ToasterHandleBinding =
  | { status: 'bound'; unbind: () => void }
  | { status: 'taken' }
  | { status: 'unknown' };

/**
 * Internal (the Toaster's layout effect; not exported from the package): binds `handle` to the
 * controller of the Toaster identified by `owner` and replays the queue in dispatch order. A handle
 * bound to another mounted Toaster is `taken`; an object that `createToaster()` did not make is
 * `unknown`. The same owner binding again (StrictMode's remount) finds the queue already taken.
 */
export function bindToasterHandle(
  handle: ToastController,
  owner: object,
  controller: ToastController,
): ToasterHandleBinding {
  const state = handleStates.get(handle);
  if (!state) return { status: 'unknown' };
  if (state.owner !== null && state.owner !== owner) return { status: 'taken' };
  state.owner = owner;
  state.controller = controller;
  const queued = state.queue;
  state.queue = [];
  for (const call of queued) call.run(controller);
  return {
    status: 'bound',
    unbind: () => {
      if (state.owner !== owner) return;
      state.owner = null;
      state.controller = null;
    },
  };
}
```

Update the module docblock's first line to `The toaster module (P3-01, P3-08): the options recogniser and the toaster handle. Server-safe: …`.

- [ ] **Step 4: The `toaster` prop in `Toaster.tsx`**

Change the `lib/toaster` import to

```ts
import { bindToasterHandle, isToastOptions } from '../../lib/toaster';
import type { ToasterHandle } from '../../lib/toaster';
```

add to `ToasterProps` after `shortcuts`:

```ts
  /** Binds this Toaster to a handle from `createToaster()`: toasts dispatched through the handle render here. */
  toaster?: ToasterHandle;
```

destructure `toaster: handle` in `Toaster`'s parameters, and add after the `controller` memo:

```tsx
  // A handle from createToaster() (P3-08, D33): bound in a layout effect, so dispatches that waited
  // in its queue show before the first paint, and unbound on unmount (StrictMode binds again and
  // finds the queue taken). A handle bound to another Toaster stays there.
  const [handleOwner] = React.useState(() => ({}));
  React.useLayoutEffect(() => {
    if (!handle) return undefined;
    const binding = bindToasterHandle(handle, handleOwner, controller);
    if (binding.status === 'bound') return binding.unbind;
    if (binding.status === 'taken') {
      warnOnce(
        'Toaster:handle-bound',
        'Toaster: this handle is already bound to another Toaster; a handle binds one Toaster. Create one handle per Toaster.',
      );
    } else {
      warnOnce(
        'Toaster:handle-unknown',
        'Toaster: `toaster` is not a handle from createToaster(), so nothing is bound. Pass the value createToaster() returns.',
      );
    }
    return undefined;
  }, [handle, handleOwner, controller]);
```

In the `Toaster` docblock, replace the first bullet's sentence:

```ts
 * - **Wrap the app** in `<Toaster>`; components below it call `useToastController()`, and code
 *   outside components (a query-cache callback, a server-event handler) dispatches through a
 *   handle from `createToaster()` bound with `toaster`, which also runs several Toasters side by
 *   side (one handle each).
```

- [ ] **Step 5: Run the tests and quick checks**

Run: `npx vitest run src/lib/__tests__/toaster.test.ts src/lib/__tests__/toaster.server.test.tsx src/components/feedback/__tests__ --reporter=default`
Expected: PASS; the server file runs in the node environment (`typeof window` is `'undefined'`).

Run: `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.dev.json --noEmit && npx eslint src/lib/toaster.ts src/lib/__tests__ src/components/feedback --max-warnings 0`
Expected: no errors (the one `no-empty-object-type` exception carries its reason).

Run: `npx vitest run src/__tests__/public-types.test.ts`
Expected: PASS (`ToasterHandle` is on `PENDING_PUBLIC_TYPES`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/toaster.ts src/lib/__tests__/toaster.test.ts src/lib/__tests__/toaster.server.test.tsx src/components/feedback/Toaster.tsx src/components/feedback/__tests__/Toaster.handle.test.tsx
git commit -m "feat(feedback): createToaster handle for dispatching from outside React components"
```

---

### Task T15: Stories

**Files:**
- Modify: `stories/Toast.stories.tsx`

**Interfaces:**
- Consumes: everything above; `createToaster` from `'../src/lib/toaster'` (module path until Task I1 switches it to `'../src'`, spec §0.2 rule 25); `Toast`, `Toaster`, `useToastController`, `Button`, `ProgressBar` from `'../src'` (the compound members reach the stories through `Toast`, which the barrel already exports).
- Produces: the stories `Parts`, `TitleAction`, `CustomIcon`, `Standalone` (P3-02), `RichContent`, `CustomContent`, `ProgressToast` (P3-01), `KeyboardShortcut` (P3-03), `FromOutsideReact` (P3-08).

- [ ] **Step 1: Add the stories**

Change the imports of `stories/Toast.stories.tsx`:

```tsx
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Drawer, ProgressBar, Toast, Toaster, useToastController } from '../src';
import type { ToastProps } from '../src';
// Module path until the package entry exports it (wave C).
import { createToaster } from '../src/lib/toaster';
```

Append:

```tsx
/** A decorative icon for the `icon` slot (it inherits the status color through currentColor). */
function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1a4 4 0 0 0-4 4v2.6L2.3 10.3a.5.5 0 0 0 .4.7h10.6a.5.5 0 0 0 .4-.7L12 7.6V5a4 4 0 0 0-4-4Zm0 14a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

/** Dispatches a Toast with a title, a body with a subtitle and a footer of actions. */
function PartsDemo({ status, title, children }: ToastProps) {
  const { dispatchToast } = useToastController();
  return (
    <Button
      appearance="primary"
      onClick={() =>
        dispatchToast(
          <Toast status={status}>
            <Toast.Title>{title}</Toast.Title>
            <Toast.Body subtitle="2 minutes ago">{children}</Toast.Body>
            <Toast.Footer>
              <Toast.Close>
                <Button size="small">Open archive</Button>
              </Toast.Close>
              <Toast.Close>
                <Button size="small" appearance="subtle">
                  Later
                </Button>
              </Toast.Close>
            </Toast.Footer>
          </Toast>,
        )
      }
    >
      Show backup toast
    </Button>
  );
}

/**
 * `Toast.Title`, `Toast.Body` (with a `subtitle`) and `Toast.Footer`. The container is named
 * "Success: Backup complete" and described by the body; the footer's buttons are actions, so the
 * toast stays until it is dismissed.
 */
export const Parts: Story = {
  args: {
    status: 'success',
    title: 'Backup complete',
    children: 'All 128 files were copied to the archive.',
  },
  render: (args) => (
    <Toaster>
      <PartsDemo {...args} />
    </Toaster>
  ),
};

/** `Toast.Close` around an Undo button at the end of the title row: it calls `onDismiss`. */
export const TitleAction: Story = {
  args: { status: 'info', title: 'Message deleted', onDismiss: fn() },
  render: ({ title, ...args }) => (
    <DismissibleToast {...args}>
      <Toast.Title
        action={
          <Toast.Close>
            <Button size="small" appearance="subtle">
              Undo
            </Button>
          </Toast.Close>
        }
      >
        {title}
      </Toast.Title>
    </DismissibleToast>
  ),
};

/** `icon` replaces the status icon (decorative); `icon={null}` shows none. */
export const CustomIcon: Story = {
  args: { status: 'info', title: 'Reminder', children: 'Stand-up starts in 5 minutes.' },
  render: (args) => <Toast {...args} icon={<BellIcon />} />,
};

/**
 * A Toast with parts rendered in the page, not dispatched: it is its own live region
 * (`role="status"`, or `role="alert"` for `error`).
 */
export const Standalone: Story = {
  args: {
    status: 'warning',
    title: 'Storage almost full',
    children: 'You have used 95% of your storage.',
    onDismiss: fn(),
  },
  render: ({ title, children, ...args }) => (
    <DismissibleToast {...args}>
      <Toast.Title>{title}</Toast.Title>
      <Toast.Body>{children}</Toast.Body>
      <Toast.Footer>
        <Button size="small">Manage storage</Button>
      </Toast.Footer>
    </DismissibleToast>
  ),
};

/** Dispatches a rich Toast whose title holds an Undo action (in `Toast.Close`). */
function RichContentDemo({ status, title, children }: ToastProps) {
  const { dispatchToast } = useToastController();
  const [undone, setUndone] = React.useState(0);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        appearance="primary"
        onClick={() =>
          dispatchToast(
            <Toast status={status}>
              <Toast.Title
                action={
                  <Toast.Close>
                    <Button
                      size="small"
                      appearance="subtle"
                      onClick={() => setUndone((count) => count + 1)}
                    >
                      Undo
                    </Button>
                  </Toast.Close>
                }
              >
                {title}
              </Toast.Title>
              <Toast.Body>{children}</Toast.Body>
            </Toast>,
          )
        }
      >
        Send email
      </Button>
      <p className="text-body-1 text-foreground">Undone {undone} times.</p>
    </div>
  );
}

/**
 * `dispatchToast(<Toast>…</Toast>)` shows rich content. The toast holds an action (Undo), so it
 * stays until it is dismissed: people using a screen reader, a switch or voice control need time
 * to reach it. Screen readers hear "Success: Email sent Your message was delivered. Undo" once.
 */
export const RichContent: Story = {
  args: { status: 'success', title: 'Email sent', children: 'Your message was delivered.' },
  render: (args) => (
    <Toaster>
      <RichContentDemo {...args} />
    </Toaster>
  ),
};

/** Dispatches content that renders no Toast, with its severity in the options. */
function CustomContentDemo({ status, children }: ToastProps) {
  const { dispatchToast } = useToastController();
  return (
    <Button
      onClick={() =>
        dispatchToast(
          <div className="flex flex-col items-start gap-2 rounded border border-border bg-background p-3 text-body-1 text-foreground shadow-4">
            {children}
            <Toast.Close>
              <Button size="small">Stay signed in</Button>
            </Toast.Close>
          </div>,
          { status },
        )
      }
    >
      Show custom content
    </Button>
  );
}

/**
 * Content without a `Toast`: the options' `status` gives it a visually hidden severity text, which
 * names the container and starts the announcement. It has no Dismiss button, so it carries a
 * `Toast.Close` (Escape and Delete dismiss it too).
 */
export const CustomContent: Story = {
  args: { status: 'warning', children: 'Your session expires in 5 minutes.' },
  render: (args) => (
    <Toaster>
      <CustomContentDemo {...args} />
    </Toaster>
  ),
};

/** Starts an upload toast (announced as "Upload started") and replaces it when it finishes. */
function ProgressToastDemo({ title, children }: ToastProps) {
  const { dispatchToast } = useToastController();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        appearance="primary"
        onClick={() =>
          dispatchToast(
            <Toast>
              <Toast.Title>{title}</Toast.Title>
              <Toast.Body subtitle={children}>
                <ProgressBar value={30} label="Upload progress" />
              </Toast.Body>
            </Toast>,
            { toastId: 'upload', timeout: 0, announcement: 'Upload started' },
          )
        }
      >
        Start upload
      </Button>
      <Button
        onClick={() => dispatchToast({ toastId: 'upload', status: 'success', title: 'Upload complete' })}
      >
        Finish upload
      </Button>
    </div>
  );
}

/** `announcement` replaces the announced text of a toast whose visible text reads badly. */
export const ProgressToast: Story = {
  args: { title: 'Uploading report.pdf', children: '3 of 10 MB' },
  render: (args) => (
    <Toaster>
      <ProgressToastDemo {...args} />
    </Toaster>
  ),
};

/** Alt+Shift+N: a shortcut with modifiers (WCAG 2.1.4). */
const altShiftN = (event: KeyboardEvent) =>
  event.altKey && event.shiftKey && event.code === 'KeyN';

/**
 * `shortcuts={{ focus: … }}`: Alt+Shift+N moves focus to the newest toast. Escape returns focus to
 * where it was and dismisses the toasts; Delete or Backspace dismisses the focused toast.
 */
export const KeyboardShortcut: Story = {
  args: { status: 'info', title: 'New comment', children: 'Ada replied to your review.' },
  render: (args) => (
    <Toaster shortcuts={{ focus: altShiftN }}>
      <div className="flex flex-col items-start gap-2">
        <p className="text-body-1 text-foreground">
          Show a toast, then press Alt+Shift+N to move focus to it.
        </p>
        <ToasterDemo {...args} />
      </div>
    </Toaster>
  ),
};

/** A handle created once at module scope, as an app keeps one next to its query client. */
const storyToaster = createToaster();

/** A plain function, no hook: code outside components dispatches through the handle. */
function notifyExportReady({ status, title, children }: ToastProps) {
  storyToaster.dispatchToast(
    <Toast status={status}>
      <Toast.Title>{title}</Toast.Title>
      <Toast.Body>{children}</Toast.Body>
    </Toast>,
  );
}

/**
 * `createToaster()` returns a handle that code outside components can call; `<Toaster toaster>`
 * binds it. The Export button calls a plain function that dispatches through the handle.
 */
export const FromOutsideReact: Story = {
  args: { status: 'success', title: 'Export ready', children: 'report.csv was saved to your downloads.' },
  render: (args) => (
    <Toaster toaster={storyToaster}>
      <Button appearance="primary" onClick={() => notifyExportReady(args)}>
        Export
      </Button>
    </Toaster>
  ),
};
```

`DismissibleToast` and `ToasterDemo` already exist in the file; `DismissibleToast` passes its children through (`{...rest}`).

- [ ] **Step 2: Run the stories gate and quick checks**

Run: `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Feedback/Toast"`
Expected: PASS for every Toast story (the new ones included).

Run: `npx tsc -p tsconfig.dev.json --noEmit && npx eslint stories/Toast.stories.tsx --max-warnings 0 && npx vitest run src/__tests__/conventions.test.ts -t "stories/Toast.stories.tsx"`
Expected: no errors; PASS (no raw color: the icon uses `currentColor`).

- [ ] **Step 3: Commit**

```bash
git add stories/Toast.stories.tsx
git commit -m "docs(feedback): Toast stories for parts, rich content, the shortcut and the handle"
```

---

### Task T16: Package gate and report

**Files:** none changed (verification and the report to the lead).

- [ ] **Step 1: Run the package's checks with clean output**

Run: `npx vitest run src/components/feedback src/lib/__tests__/toaster.test.ts src/lib/__tests__/toaster.server.test.tsx --reporter=default`
Expected: PASS, and the output shows no `act(...)` warning and no `[WaveUI]` line outside an asserting spy.

Run: `npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/Toast" && npx vitest run src/__tests__/conventions.test.ts -t "stories/Toast.stories.tsx" && npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Feedback/Toast"`
Expected: PASS.

Run: `npx vitest run src/__tests__/classNames.test.ts src/__tests__/public-types.test.ts src/__tests__/integration.test.tsx src/__tests__/test-utils.test.tsx`
Expected: PASS (the Phase 3 constants and types wait on `PENDING_CLASS_NAMES` and `PENDING_PUBLIC_TYPES`; the 0.7 integration cases, `[data-wave-toast] *` at `integration.test.tsx:1025` included, still pass).

Run: `npm run typecheck && npm run lint && npm run format:check`
Expected: exit 0.

Run: `npm run build`
Expected: exit 0; `verify-dist` reports `Toast` as planned on the `PENDING_FLAT_EXPORTS` bridge (its flat names reach the entry in wave C) and nothing else.

- [ ] **Step 2: Report to the lead**

The report lists:
- the files of the package and the commits of T1–T15;
- the barrel and entry requests for INTEGRATION (spec §4.3): `src/components/feedback/index.ts` gains `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose` and the types `ToastTitleProps`, `ToastBodyProps`, `ToastFooterProps`, `ToastCloseProps`, `ToastCloseRenderProps`, `ToastDispatchOptions`, `ToasterShortcuts` (all re-exported by `./Toast`); `src/index.ts` gains `createToaster` and the type `ToasterHandle` from `./lib/toaster` (never `isToastOptions`, `bindToasterHandle` or `ToasterHandleBinding`); the probes of §6.2 (an import of only `Toaster` contains `hooks/usePresence`; `lib/toaster` loads under `--conditions=react-server` and `createToaster().dispatchToast(…)` returns an id; an import of only `Button` contains no `lib/toaster`);
- the 0.7 tests updated, with the reason: `Toast.test.tsx` `bodyAfter` (the title text sits in `Toast.Title`'s label span, T2), the container role at `:537-538` and the `getToasts` comment (D10, T5), "pauses only the hovered toast" → "pauses every toast while the pointer is over one of them" (D14, T13);
- the additions beyond the spec's file list (`__tests__/toasterHarness.tsx`, `src/lib/__tests__/toaster.server.test.tsx`), the extra development warning `Toaster:handle-unknown`, and the one lint exception (`no-empty-object-type` on `ToasterHandle`);
- the behaviours asserted only as attributes or DOM text, for the lead's checklist: what screen readers speak for the live regions and the named group, the `inert` exiting container, focus-visible on a container focused by the shortcut, the region-wide pause under real pointer movement;
- the lead's real-browser and screen-reader checks (spec §6.3), to run in Storybook (`Components/Feedback/Toast`: `RichContent`, `CustomContent`, `KeyboardShortcut`, `Parts`, `TitleAction`, `FromOutsideReact`, `ToasterBesideDrawer`):
  - **Item 2, Toasts:** a rich toast is announced once ("Success: Email sent Your message was delivered. Undo"), an error toast assertively; the shortcut focuses the newest toast and the screen reader announces its group name; Escape returns focus to where it was; Escape with a tooltip shown on a toast's button hides only the tooltip; Delete and Backspace dismiss (also with JAWS's virtual cursor on, where the keys may be taken by the screen reader: record it); Escape in a toast over a Dialog leaves the Dialog open; the timers stay paused while a menu opened from a toast has focus; a toast with an action stays and can be reached with TalkBack, VoiceOver iOS, Voice Control and Dragon ("click Undo"); toasts that stay never hide a focused element of the page (WCAG 2.4.11); with an app's exit classes and reduced motion off, focus never lands on an exiting toast.
  - **Item 6, the toaster handle:** a toast dispatched from a plain module function in the story is announced and behaves like a hook-dispatched one; a server-rendered page with a module-scope handle carries no toast.

- [ ] **Step 3: Commit**

Nothing to commit: this task changes no file.
