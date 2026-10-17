# WaveUI 0.8.0 Phase 3 — MessageBar (P3-messagebar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give MessageBar a `MessageBar.Title` and a `MessageBar.Actions` part, the title-labelling rule of a non-live bar, and a `layout` prop whose `'auto'` default moves the actions under the text only when the text no longer fits on one line (P3-04: `messagebar-2`, `messagebar-1`, `messagebar-3`).

**Architecture:** MessageBar becomes an `Object.assign` compound whose root stays in `MessageBar.tsx`; the parts, a placement context and the partition of the bar's children live in `MessageBar.parts.tsx`, which never imports the compound module. The root sorts its direct children by a static scan (`flattenChildren` + `isElementOfType`), so the placement is in the server HTML; the layouts are class switches on one DOM order (icon, text column, actions, Dismiss), with a layout wrapper around the text column and the actions only when actions render. `layout="auto"` reads its layout from a per-bar store in `MessageBar.reflow.ts` through `useSyncExternalStore`, fed by a ResizeObserver on the root, a MutationObserver on the text column and a before-paint measurement after every one-row commit.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 (`cn` = clsx + tailwind-merge), Vitest + React Testing Library + jsdom + vitest-axe, Storybook 10

**Spec:** `docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md` — §2 P3-04; rulings D15, D16, D17 (§0.3); §1.3 and §4.2 (the `id` of `StatusText`); §4.1 (class names); §6.4 (the P3-messagebar bullet); §6.3 real-browser checklist item 3 (manual checks of the package report).

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

- One DOM order in every layout: icon, text column, actions, Dismiss button. A bar without actions that render content keeps 0.7's markup exactly, plus `data-layout` (D17; §6.4: `MessageBar.test.tsx:169` and `:1352` pin it and must stay green unchanged).
- No layout cuts text off: the text column never gets a truncating, ellipsis, clamping or overflow-hiding class, and the layouts are classes only (no inline style, no runtime CSS).
- `MessageBar.parts.tsx` and `MessageBar.reflow.ts` never import `MessageBar.tsx` (D32). `MessageBar.status.tsx` stays read-only (§4.2): the severity text gets its id through `StatusText`'s `id` prop (Task A3).
- Every use of `ResizeObserver`, `MutationObserver` and `window` is guarded (`typeof … !== 'undefined'`): jsdom, `src/test-setup.ts` and the stories axe gate install no ResizeObserver.
- Wave-B tests render only the foundation, 0.7 APIs and this package's own APIs (Phase 1 rule 9); combinations with another wave-B component are INTEGRATION's (§4.4 #6).

## Review Focus

1. **`MessageBar.Actions` (or `MessageBar.Title`) whose children render nothing** — `<MessageBar.Actions>{canRetry && <Button>Retry</Button>}</MessageBar.Actions>` with `canRetry === false`, or `<MessageBar.Title>{''}</MessageBar.Title>`: decided with `slotRendersContent`, the part is left out, so the bar renders 0.7's markup (`data-layout="multiline"` under `'auto'`), creates no observer, adds no stray space and names nothing (a `role="region"` bar then warns). → Tasks M1 (markup), M2 (naming), M4 (no observer)
2. **Actions that appear or disappear, and a `layout` prop that changes, after mount** — the observer attaches and detaches with them, and a bar that measures again starts from the one-row layout (a stale `multiline` from the last measurement never survives). → Task M4
3. **No `ResizeObserver` in the environment** (jsdom, the stories axe gate, an embedded webview) — an `'auto'` bar with actions renders the one-row layout, never throws, still measures after each of its renders and follows window resizes. → Task M4
4. **A wrapper component that forwards `aria-label={undefined}` or `aria-labelledby={undefined}`** to a `role="region"` bar — an `undefined` prop is not a name of the consumer's: the title still names the bar, and no `MessageBar:region-name` warning fires. → Task M2
5. **Text that changes after mount without a render of the bar** (a live countdown or upload progress rendered by a child component with its own state) — the one-row `'auto'` bar re-measures and moves the actions below instead of letting its unwrapped text run under them, and a multiline bar whose text got shorter returns to one row when the text fits. → Task M4

## File Structure

| File | Responsibility |
|---|---|
| `src/components/feedback/MessageBar.parts.tsx` (create) | `MessageBar.Title` and `MessageBar.Actions` (flat `MessageBarTitle`, `MessageBarActions`), their props types, the placement context `MessageBarPartContext` with its constants, and `partitionMessageBarChildren` (the static scan). Never imports `MessageBar.tsx`. |
| `src/components/feedback/MessageBar.reflow.ts` (create) | `useMessageBarReflow(root, text, enabled)`: the per-bar measurement store of an `'auto'` bar with actions (the two-way width rule, observers, before-paint measurement). Internal. |
| `src/components/feedback/MessageBar.tsx` (modify) | The root (renamed `MessageBarRoot`, no docblock of its own), the partitioned render, the labelling rule, `layout` and `data-layout`, the `Object.assign` compound with the component docblock, the flat re-exports of the parts and their types. |
| `src/components/feedback/__tests__/MessageBar.parts.test.tsx` (create) | Parts, partition, misplaced-part warnings, labelling, layouts, axe. |
| `src/components/feedback/__tests__/MessageBar.reflow.test.tsx` (create) | The `'auto'` measurement: observers, the width rule, text changes, SSR and hydration, StrictMode, the no-ResizeObserver fallback. |
| `src/components/feedback/__tests__/MessageBar.test.tsx` (modify) | `data-layout` on every bar, 0.7's markup of a bar without actions, the `layout` type contract. |
| `stories/MessageBar.stories.tsx` (modify) | `WithTitle`, `WithActions`, `Multiline`, `Reflow`, `RegionNotice`; the `layout` argType. |

Read-only inputs: `src/lib/classNames.ts` (Task A1: `messageBarClassNames`, `messageBarTitleClassNames`, `messageBarActionsClassNames`), `src/components/feedback/MessageBar.status.tsx` (Task A3: `StatusText({ label, id })`), and the stable classes Task A6 applied to MessageBar's 0.7 elements. The barrel `src/components/feedback/index.ts` is untouched: it keeps importing `MessageBar` and `MessageBarProps` from `./MessageBar`, and INTEGRATION adds the flat names and part types in wave C (§4.3).

---

### Task M1: The compound — `MessageBar.Title`, `MessageBar.Actions` and the partition

**Files:**
- Create: `src/components/feedback/MessageBar.parts.tsx`
- Modify: `src/components/feedback/MessageBar.tsx` (the root's docblock and name, lines 312–337 at 0.7; the return block, lines 428–450 at 0.7, as Task A6 left it; the end of the file)
- Test: `src/components/feedback/__tests__/MessageBar.parts.test.tsx` (create)

**Interfaces:**
- Consumes: `messageBarClassNames` (`root`, `icon`, `body`, `dismissButton`, `dismissIcon`), `messageBarTitleClassNames.root` (`'wave-message-bar-title'`), `messageBarActionsClassNames.root` (`'wave-message-bar-actions'`) from `src/lib/classNames.ts` (Task A1); the classes Task A6 applied to the 0.7 elements; `flattenChildren`, `isElementOfType` (`src/lib/children.ts`); `slotRendersContent`, `materialiseSlotContent` (`src/lib/slot.ts`); `reportMissingContext`, `warnOnce` (`src/lib/dev.ts`); `useId(prefix)` (`src/hooks/useId.ts`).
- Produces (public, flat names re-exported from `MessageBar.tsx`; the barrel exports them in Task I1):
  - `export interface MessageBarTitleProps extends React.HTMLAttributes<HTMLSpanElement> { ref?: React.Ref<HTMLSpanElement> }`
  - `export interface MessageBarActionsProps extends React.HTMLAttributes<HTMLDivElement> { ref?: React.Ref<HTMLDivElement> }`
  - `export const MessageBarTitle: (props: MessageBarTitleProps) => React.JSX.Element` (displayName `'MessageBarTitle'`)
  - `export const MessageBarActions: (props: MessageBarActionsProps) => React.JSX.Element` (displayName `'MessageBarActions'`)
  - `export const MessageBar = Object.assign(MessageBarRoot, { Title: MessageBarTitle, Actions: MessageBarActions })`
- Produces (internal, `MessageBar.parts.tsx`): `MessageBarPartContext`, `MessageBarPartContextValue`, `CONTENT_PLACEMENT`, `ACTIONS_PLACEMENT`, `EXTRA_TITLE_PLACEMENT`, `partitionMessageBarChildren(children: React.ReactNode): MessageBarPartition`.
- Warning keys: `MessageBar.Title:unscanned`, `MessageBar.Actions:unscanned`, `MessageBar.Title:multiple`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/feedback/__tests__/MessageBar.parts.test.tsx`:

```tsx
import * as React from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import { MessageBar, MessageBarActions, MessageBarTitle } from '../MessageBar';
import type { MessageBarActionsProps, MessageBarTitleProps } from '../MessageBar';
import { Button } from '../../button/Button';
import {
  messageBarActionsClassNames,
  messageBarClassNames,
  messageBarTitleClassNames,
} from '../../../lib/classNames';
import {
  asClientReference,
  expectThrows,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';

const TITLE_UNSCANNED =
  '[WaveUI] MessageBar.Title is not a direct child of MessageBar, so it is not placed first in the text. Make it a direct child.';
const ACTIONS_UNSCANNED =
  '[WaveUI] MessageBar.Actions is not a direct child of MessageBar, so it is not placed in the action area. Make it a direct child.';
const TITLE_MULTIPLE =
  '[WaveUI] MessageBar.Title: this MessageBar already has a title (its first MessageBar.Title among its direct children), so this one renders as body text. Give a bar one title.';

/** Records `console.warn` for one test (restored after each test); assert what it recorded. */
const spyOnWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

/** Renders a part as a direct child of a MessageBar (the wrapper of `testSystemProps`). */
function InBar({ children }: { children: React.ReactNode }) {
  return <MessageBar>{children}</MessageBar>;
}

/** A title inside the app's own component: the bar's scan cannot see it. */
function WrappedTitle() {
  return <MessageBar.Title id="own-title">Wrapped</MessageBar.Title>;
}

/** Actions inside the app's own component. */
function WrappedActions() {
  return (
    <MessageBar.Actions>
      <Button>Wrapped action</Button>
    </MessageBar.Actions>
  );
}

/** A title the app renders inside another part. */
function NestedTitle() {
  return <MessageBar.Title>Nested</MessageBar.Title>;
}

/** The bar's text column: the element with the stable `body` class. */
function textColumn(bar: HTMLElement): HTMLElement {
  const column = bar.querySelector<HTMLElement>(`.${messageBarClassNames.body}`);
  if (!column) throw new Error('the bar has no text column');
  return column;
}

/** The `MessageBar.Actions` element around `node`. */
function actionsOf(node: HTMLElement): HTMLElement {
  const actions = node.closest<HTMLElement>(`.${messageBarActionsClassNames.root}`);
  if (!actions) throw new Error('not inside MessageBar.Actions');
  return actions;
}

describe('MessageBar parts (P3-04)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testCompoundExposure(MessageBar, ['Title', 'Actions']);

  it('exports each part under its flat name (C-COMPOUND)', () => {
    expect(MessageBarTitle).toBe(MessageBar.Title);
    expect(MessageBarActions).toBe(MessageBar.Actions);
  });

  describe('MessageBar.Title', () => {
    testSystemProps(MessageBarTitle, {
      expectedTag: 'span',
      displayName: 'MessageBarTitle',
      defaultProps: { children: 'Update available' },
      conflictingClass: { className: 'font-normal', overrides: 'font-semibold' },
      wrapper: InBar,
    });

    it('declares ref in the props interface (C-REF)', () => {
      expectTypeOf<MessageBarTitleProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLSpanElement> | undefined
      >();
    });
  });

  describe('MessageBar.Actions', () => {
    testSystemProps(MessageBarActions, {
      expectedTag: 'div',
      displayName: 'MessageBarActions',
      defaultProps: { children: <Button>Retry</Button> },
      conflictingClass: { className: 'gap-4', overrides: 'gap-2' },
      wrapper: InBar,
    });

    it('declares ref in the props interface (C-REF)', () => {
      expectTypeOf<MessageBarActionsProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLDivElement> | undefined
      >();
    });

    it('has no role of its own (the bar is the grouping)', () => {
      render(
        <MessageBar>
          Body
          <MessageBar.Actions>
            <Button>Retry</Button>
          </MessageBar.Actions>
        </MessageBar>,
      );
      expect(actionsOf(screen.getByRole('button', { name: 'Retry' }))).not.toHaveAttribute('role');
    });
  });

  describe('partition of the children (D15)', () => {
    it('reads the title first after the severity text and places the actions after the text', () => {
      render(
        <MessageBar status="warning">
          <MessageBar.Actions>
            <Button>Update now</Button>
          </MessageBar.Actions>
          A new version is ready to install.
          <MessageBar.Title>Update available</MessageBar.Title>
        </MessageBar>,
      );
      const bar = screen.getByRole('alert');
      const text = textColumn(bar);
      expect(text).toHaveTextContent(
        /^Warning:\s*Update available A new version is ready to install\.$/,
      );
      const action = screen.getByRole('button', { name: 'Update now' });
      const actions = actionsOf(action);
      expect(actions).toHaveClass(messageBarActionsClassNames.root);
      expect(text).not.toContainElement(action);
      expect(text.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('finds parts inside Fragments', () => {
      render(
        <MessageBar status="success">
          <>
            <MessageBar.Title>Saved</MessageBar.Title>
            <>
              <MessageBar.Actions>
                <Button>Undo</Button>
              </MessageBar.Actions>
            </>
          </>
          Your changes are live.
        </MessageBar>,
      );
      const text = textColumn(screen.getByRole('status'));
      expect(text).toHaveTextContent(/^Success:\s*Saved Your changes are live\.$/);
      expect(text).not.toContainElement(screen.getByRole('button', { name: 'Undo' }));
    });

    it('keeps the rest of the body in its order', () => {
      render(
        <MessageBar>
          {'Before '}
          <strong>bold</strong>
          <MessageBar.Title>Heads up</MessageBar.Title>
          {' after'}
        </MessageBar>,
      );
      expect(textColumn(screen.getByRole('status'))).toHaveTextContent(
        /^Info:\s*Heads up Before bold after$/,
      );
    });

    it('finds parts written in a Server Component (lazy references): same server HTML and placement', () => {
      const Title = asClientReference(MessageBar.Title);
      const Actions = asClientReference(MessageBar.Actions);
      const plain = (
        <MessageBar status="warning">
          Install it tonight.
          <MessageBar.Title>Update available</MessageBar.Title>
          <MessageBar.Actions>
            <Button>Update now</Button>
          </MessageBar.Actions>
        </MessageBar>
      );
      const lazy = (
        <MessageBar status="warning">
          Install it tonight.
          <Title>Update available</Title>
          <Actions>
            <Button>Update now</Button>
          </Actions>
        </MessageBar>
      );
      expect(renderToString(lazy)).toBe(renderToString(plain));

      render(lazy);
      const text = textColumn(screen.getByRole('alert'));
      expect(text).toHaveTextContent(/^Warning:\s*Update available Install it tonight\.$/);
      expect(text).not.toContainElement(screen.getByRole('button', { name: 'Update now' }));
    });

    it('renders the placed title with its stable class and a generated id, or the consumer id', () => {
      const { rerender } = render(
        <MessageBar>
          <MessageBar.Title>Heads up</MessageBar.Title>
          Body
        </MessageBar>,
      );
      const title = screen.getByText('Heads up');
      expect(title.tagName).toBe('SPAN');
      expect(title).toHaveClass(messageBarTitleClassNames.root, 'font-semibold');
      expect(title.id).toMatch(/^wave-message-bar-title-/);

      rerender(
        <MessageBar>
          <MessageBar.Title id="release-title">Heads up</MessageBar.Title>
          Body
        </MessageBar>,
      );
      expect(screen.getByText('Heads up')).toHaveAttribute('id', 'release-title');
    });

    it('leaves out a title or actions whose children render nothing (the bar keeps its look)', () => {
      const { container, rerender } = render(<MessageBar onDismiss={() => {}}>Body</MessageBar>);
      const withoutParts = container.innerHTML;
      rerender(
        <MessageBar onDismiss={() => {}}>
          <MessageBar.Title>{''}</MessageBar.Title>
          Body
          <MessageBar.Actions>{false}</MessageBar.Actions>
        </MessageBar>,
      );
      expect(container.innerHTML).toBe(withoutParts);
      expect(container.getElementsByClassName(messageBarActionsClassNames.root)).toHaveLength(0);
      expect(container.getElementsByClassName(messageBarTitleClassNames.root)).toHaveLength(0);
    });

    it('renders actions given as a generator (read once)', () => {
      function* buttons() {
        yield <Button key="retry">Retry</Button>;
        yield <Button key="details">Details</Button>;
      }
      render(
        <MessageBar>
          Body
          <MessageBar.Actions>{buttons()}</MessageBar.Actions>
        </MessageBar>,
      );
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    });
  });

  describe('misplaced parts', () => {
    it('a title the scan cannot see renders where it is, keeps only its own id and warns', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar>
          {'Before '}
          <WrappedTitle />
          {' after'}
        </MessageBar>,
      );
      expect(textColumn(screen.getByRole('status'))).toHaveTextContent(
        /^Info:\s*Before Wrapped after$/,
      );
      expect(screen.getByText('Wrapped')).toHaveAttribute('id', 'own-title');
      expect(warn.mock.calls).toEqual([[TITLE_UNSCANNED]]);
    });

    it('actions the scan cannot see render where they are and warn', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar>
          Body
          <WrappedActions />
        </MessageBar>,
      );
      const action = screen.getByRole('button', { name: 'Wrapped action' });
      expect(textColumn(screen.getByRole('status'))).toContainElement(action);
      expect(warn.mock.calls).toEqual([[ACTIONS_UNSCANNED]]);
    });

    it('a title inside another part is not placed', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar>
          Body
          <MessageBar.Actions>
            <Button>Retry</Button>
            <NestedTitle />
          </MessageBar.Actions>
        </MessageBar>,
      );
      expect(screen.getByText('Nested')).not.toHaveAttribute('id');
      expect(warn.mock.calls).toEqual([[TITLE_UNSCANNED]]);
    });

    it('a second title renders as body text, with no generated id, and warns once', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar>
          <MessageBar.Title>First</MessageBar.Title>
          {'Body '}
          <MessageBar.Title>Second</MessageBar.Title>
        </MessageBar>,
      );
      expect(textColumn(screen.getByRole('status'))).toHaveTextContent(
        /^Info:\s*First Body Second$/,
      );
      expect(screen.getByText('First').id).toMatch(/^wave-message-bar-title-/);
      expect(screen.getByText('Second')).not.toHaveAttribute('id');
      expect(screen.getByText('Second')).toHaveClass(messageBarTitleClassNames.root);
      expect(warn.mock.calls).toEqual([[TITLE_MULTIPLE]]);
    });

    it('throws outside a MessageBar (C-CONTEXT)', () => {
      expectThrows(
        <MessageBar.Title>Heads up</MessageBar.Title>,
        '[WaveUI] MessageBar.Title must be used within <MessageBar>',
      );
      expectThrows(
        <MessageBar.Actions>
          <Button>Retry</Button>
        </MessageBar.Actions>,
        '[WaveUI] MessageBar.Actions must be used within <MessageBar>',
      );
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/MessageBar.parts.test.tsx`
Expected: FAIL — `MessageBar.Title` and `MessageBar.Actions` are `undefined` and the flat imports resolve to `undefined` (Vitest does not type-check), so the exposure, `testSystemProps` and partition cases fail; `npx tsc -p tsconfig.dev.json --noEmit` reports the missing exports.

- [ ] **Step 3: Create `src/components/feedback/MessageBar.parts.tsx`**

```tsx
import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { messageBarActionsClassNames, messageBarTitleClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';

/** Properties for the MessageBarTitle sub-component. */
export interface MessageBarTitleProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Ref to the title `<span>`. */
  ref?: React.Ref<HTMLSpanElement>;
}

/** Properties for the MessageBarActions sub-component. */
export interface MessageBarActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the element that holds the actions. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Where a MessageBar put a part (C-CONTEXT: `null` outside every MessageBar). The bar provides
 * `'content'` around everything it renders and a more specific value around the parts that its
 * scan of its direct children placed; each part resets it to `'content'` for its own children, so
 * a part inside another part, or inside the app's own component, counts as not placed.
 */
export interface MessageBarPartContextValue {
  /**
   * `'title'`: the bar's title, first in the text column. `'actions'`: in the action area.
   * `'extra-title'`: a later title, left in the body. `'content'`: anywhere else inside the bar.
   */
  placement: 'title' | 'actions' | 'extra-title' | 'content';
  /** The id the placed title renders (its own `id`, else a generated one); `'title'` only. */
  titleId?: string;
}

export const MessageBarPartContext = React.createContext<MessageBarPartContextValue | null>(null);
MessageBarPartContext.displayName = 'MessageBarPartContext';

/** Inside a bar but not placed by its scan (also the inert value in production, C-CONTEXT). */
export const CONTENT_PLACEMENT: MessageBarPartContextValue = { placement: 'content' };
/** A `MessageBar.Actions` the bar placed in its action area. */
export const ACTIONS_PLACEMENT: MessageBarPartContextValue = { placement: 'actions' };
/** A second or later `MessageBar.Title`, rendered where it is in the body. */
export const EXTRA_TITLE_PLACEMENT: MessageBarPartContextValue = { placement: 'extra-title' };

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
function useMessageBarPart(componentName: string): MessageBarPartContextValue {
  const context = React.useContext(MessageBarPartContext);
  if (context) return context;
  reportMissingContext(componentName, '<MessageBar>');
  return CONTENT_PLACEMENT;
}

/**
 * The bar's title, read right after the severity text. Names the bar when the bar has a non-live
 * `role` (`region`, `group`). Must be a direct child of MessageBar (a Fragment there counts, and so
 * does a title written in a Server Component); anywhere else it renders where it is, without its
 * place or the naming (development warning). Give a bar one title: a second one renders as body
 * text (development warning). A title whose children render nothing is left out.
 *
 * Also exported as `MessageBarTitle` (import the flat name from React Server Components).
 */
export const MessageBarTitle = ({ id, className, children, ref, ...rest }: MessageBarTitleProps) => {
  const part = useMessageBarPart('MessageBar.Title');
  const placed = part.placement === 'title';
  const problem: 'unscanned' | 'multiple' | null = placed
    ? null
    : part.placement === 'extra-title'
      ? 'multiple'
      : 'unscanned';
  React.useEffect(() => {
    if (problem === 'unscanned') {
      warnOnce(
        'MessageBar.Title:unscanned',
        'MessageBar.Title is not a direct child of MessageBar, so it is not placed first in the text. Make it a direct child.',
      );
    } else if (problem === 'multiple') {
      warnOnce(
        'MessageBar.Title:multiple',
        'MessageBar.Title: this MessageBar already has a title (its first MessageBar.Title among its direct children), so this one renders as body text. Give a bar one title.',
      );
    }
  }, [problem]);

  return (
    <span
      {...rest}
      ref={ref}
      id={(placed ? part.titleId : id) || undefined}
      className={cn(messageBarTitleClassNames.root, 'font-semibold', className)}
    >
      <MessageBarPartContext.Provider value={CONTENT_PLACEMENT}>
        {materialiseSlotContent(children)}
      </MessageBarPartContext.Provider>
    </span>
  );
};
MessageBarTitle.displayName = 'MessageBarTitle';

/**
 * The bar's actions (Retry, Learn more): after the text on one row, on their own row under it in
 * the multiline layout. Must be a direct child of MessageBar (a Fragment there counts, and so does
 * a part written in a Server Component); anywhere else it renders where it is (development
 * warning). Actions whose children render nothing are left out, so the bar keeps its look without
 * actions. The actions have no role of their own: the bar is already the grouping.
 *
 * Also exported as `MessageBarActions` (import the flat name from React Server Components).
 */
export const MessageBarActions = ({ className, children, ref, ...rest }: MessageBarActionsProps) => {
  const part = useMessageBarPart('MessageBar.Actions');
  const placed = part.placement === 'actions';
  React.useEffect(() => {
    if (!placed) {
      warnOnce(
        'MessageBar.Actions:unscanned',
        'MessageBar.Actions is not a direct child of MessageBar, so it is not placed in the action area. Make it a direct child.',
      );
    }
  }, [placed]);

  return (
    <div
      {...rest}
      ref={ref}
      className={cn(
        messageBarActionsClassNames.root,
        'flex shrink-0 flex-wrap items-center gap-2',
        className,
      )}
    >
      <MessageBarPartContext.Provider value={CONTENT_PLACEMENT}>
        {materialiseSlotContent(children)}
      </MessageBarPartContext.Provider>
    </div>
  );
};
MessageBarActions.displayName = 'MessageBarActions';

/** How a MessageBar sorts its direct children (D15). */
export interface MessageBarPartition {
  /** The first `MessageBar.Title` whose children render content, with its flattened key. */
  title: { key: string; element: React.ReactElement<MessageBarTitleProps> } | undefined;
  /** Every `MessageBar.Actions` whose children render content, in order. */
  actions: Array<{ key: string; element: React.ReactElement<MessageBarActionsProps> }>;
  /** Everything else, in order; `extraTitle` marks a later title that renders content. */
  body: Array<{ key: string; node: React.ReactNode; extraTitle: boolean }>;
}

/**
 * The static scan of D15, during render (so the placement is in the server HTML): the direct
 * children with Fragments flattened, parts recognised by `isElementOfType` (a part written in a
 * Server Component arrives as a lazy reference). A part whose children render nothing
 * (`slotRendersContent`) is dropped.
 */
export function partitionMessageBarChildren(children: React.ReactNode): MessageBarPartition {
  let title: MessageBarPartition['title'];
  const actions: MessageBarPartition['actions'] = [];
  const body: MessageBarPartition['body'] = [];
  for (const { key, node } of flattenChildren(children)) {
    if (isElementOfType<MessageBarTitleProps>(node, MessageBarTitle)) {
      if (!slotRendersContent(node.props.children)) continue;
      if (title === undefined) title = { key, element: node };
      else body.push({ key, node, extraTitle: true });
    } else if (isElementOfType<MessageBarActionsProps>(node, MessageBarActions)) {
      if (slotRendersContent(node.props.children)) actions.push({ key, element: node });
    } else {
      body.push({ key, node, extraTitle: false });
    }
  }
  return { title, actions, body };
}
```

- [ ] **Step 4: Move the component docblock and rename the root in `MessageBar.tsx`**

Add to the imports (keep the existing ones, including the `messageBarClassNames` import that Task A6 added):

```tsx
import { useId } from '../../hooks/useId';
import {
  ACTIONS_PLACEMENT,
  CONTENT_PLACEMENT,
  EXTRA_TITLE_PLACEMENT,
  MessageBarActions,
  MessageBarPartContext,
  MessageBarTitle,
  partitionMessageBarChildren,
} from './MessageBar.parts';
import type { MessageBarPartContextValue } from './MessageBar.parts';
```

Replace the JSDoc of `children` in `MessageBarProps`:

```tsx
  /** Message content to display. */
  children: React.ReactNode;
```

with:

```tsx
  /**
   * The message: body text, with the parts `MessageBar.Title` and `MessageBar.Actions` as direct
   * children (see the component docs).
   */
  children: React.ReactNode;
```

Delete the whole component docblock above the root (0.7 lines 312–326: from the `/**` whose first line is `An inline message that tells the user about the state of a page or task: a status icon, a` down to the ` */` after its `@example`); Step 6 writes its new version on the compound const. Then replace the root's first line:

```tsx
export const MessageBar = ({
```

with:

```tsx
// The MessageBar root, documented on the exported `MessageBar` const.
const MessageBarRoot = ({
```

- [ ] **Step 5: Render the partition**

Replace the return block of the root and its `displayName` (0.7 lines 428–450, with the classes Task A6 added; keep A6's exact class expressions of the icon and the Dismiss button, which this task does not touch). Before:

```tsx
  return (
    <div
      ref={ref}
      role={status === 'error' || status === 'warning' ? 'alert' : 'status'}
      {...rest}
      className={cn(
        messageBarClassNames.root,
        'flex items-start gap-3 rounded border-s-4 px-4 py-3 text-foreground',
        tintClasses[status],
        STATUS_BORDER[status],
        className,
      )}
    >
      {renderedIcon}
      <div className={cn(messageBarClassNames.body, 'min-w-0 flex-1 text-body-1')}>
        <StatusText label={getStatusLabel(status, statusLabel)} />
        {children}
      </div>
      {renderedDismiss}
    </div>
  );
};

MessageBar.displayName = 'MessageBar';
```

After:

```tsx
  // Parts (D15): a static scan of the direct children (Fragments flattened, Server Component
  // references included), so the title and the actions are placed in the server HTML too.
  const { title, actions, body } = partitionMessageBarChildren(children);
  const generatedTitleId = useId('wave-message-bar-title');
  const titleId = title?.element.props.id || generatedTitleId;
  const titlePlacement = React.useMemo<MessageBarPartContextValue>(
    () => ({ placement: 'title', titleId }),
    [titleId],
  );

  // The text column: the severity text, the title (and a space, so the two never run together),
  // then the body in its order.
  const text = (
    <div className={cn(messageBarClassNames.body, 'min-w-0 flex-1 text-body-1')}>
      <StatusText label={getStatusLabel(status, statusLabel)} />
      {title && (
        <MessageBarPartContext.Provider value={titlePlacement}>
          {title.element}
        </MessageBarPartContext.Provider>
      )}
      {title && ' '}
      {body.map(({ key, node, extraTitle }) =>
        extraTitle ? (
          <MessageBarPartContext.Provider key={key} value={EXTRA_TITLE_PLACEMENT}>
            {node}
          </MessageBarPartContext.Provider>
        ) : (
          <React.Fragment key={key}>{node}</React.Fragment>
        ),
      )}
    </div>
  );

  return (
    <div
      ref={ref}
      role={status === 'error' || status === 'warning' ? 'alert' : 'status'}
      {...rest}
      className={cn(
        messageBarClassNames.root,
        'flex items-start gap-3 rounded border-s-4 px-4 py-3 text-foreground',
        tintClasses[status],
        STATUS_BORDER[status],
        className,
      )}
    >
      <MessageBarPartContext.Provider value={CONTENT_PLACEMENT}>
        {renderedIcon}
        {actions.length > 0 ? (
          // A layout wrapper (not a part): the text column and the actions, in this DOM order.
          <div className="flex min-w-0 flex-1 items-start gap-x-3 gap-y-2">
            {text}
            <MessageBarPartContext.Provider value={ACTIONS_PLACEMENT}>
              {actions.map(({ key, element }) => (
                <React.Fragment key={key}>{element}</React.Fragment>
              ))}
            </MessageBarPartContext.Provider>
          </div>
        ) : (
          text
        )}
        {renderedDismiss}
      </MessageBarPartContext.Provider>
    </div>
  );
};
MessageBarRoot.displayName = 'MessageBar';
```

- [ ] **Step 6: Add the compound, its docblock and the flat re-exports at the end of `MessageBar.tsx`**

```tsx
/**
 * An inline message that tells the user about the state of a page or task: a status icon, a
 * visually hidden status label ("Warning:"), an optional title, the message, optional actions and
 * an optional dismiss button.
 *
 * - The status sets the tint, the logical start border, the icon and the role (`alert` for
 *   `warning`/`error`, `status` otherwise). Screen readers hear the severity through `statusLabel`.
 * - Parts, as direct children: `MessageBar.Title` (a semibold lead-in, read first after the
 *   severity) and `MessageBar.Actions` (buttons after the text on one row, or below it with
 *   `layout="multiline"`). The built-in Dismiss button stays the bar's own.
 * - With its default roles the bar is a live region and the title is read as the start of its
 *   content; give the bar `role="region"` (a notice that stays on the page) and the title names it.
 * - The dismiss button is always the MessageBar's own `<button>` wired to `onDismiss`
 *   (`type="button"` unless a merged button slot sets its own `type`); the `dismiss` slot only
 *   replaces its content (see {@link MessageBarProps.dismiss}).
 *
 * React Server Components cannot dot into a client module: import the flat names
 * `MessageBarTitle` and `MessageBarActions` there; `MessageBar.Title` and `MessageBar.Actions`
 * work in client files.
 *
 * @example
 * <MessageBar status="warning" onDismiss={() => setVisible(false)}>
 *   <MessageBar.Title>Update available</MessageBar.Title>
 *   A new version is ready to install.
 *   <MessageBar.Actions>
 *     <Button size="small">Update now</Button>
 *   </MessageBar.Actions>
 * </MessageBar>
 */
export const MessageBar = /* @__PURE__ */ Object.assign(MessageBarRoot, {
  Title: MessageBarTitle,
  Actions: MessageBarActions,
});

export { MessageBarTitle, MessageBarActions };
export type { MessageBarTitleProps, MessageBarActionsProps } from './MessageBar.parts';
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/components/feedback/__tests__/MessageBar.parts.test.tsx src/components/feedback/__tests__/MessageBar.test.tsx --reporter=default`
Expected: PASS, with no act() warning and no unasserted `[WaveUI]` line in the output (the 0.7 suite is unchanged and green).

- [ ] **Step 8: Quick checks**

```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/components/feedback/MessageBar.tsx src/components/feedback/MessageBar.parts.tsx src/components/feedback/__tests__/MessageBar.parts.test.tsx --max-warnings 0
npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/MessageBar"
npx vitest run .storybook/__tests__/exportDocblocks.test.ts src/__tests__/classNames.test.ts src/__tests__/public-types.test.ts
npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Feedback/MessageBar"
node scripts/build-css.mjs
```

Expected: all pass. The library `tsc` includes `src/components/feedback/index.ts`, which still imports `MessageBar` and `MessageBarProps` from `./MessageBar` (spec §0.2 rule 22). The conventions gate's `class-names` rule finds `messageBarTitleClassNames.root` and `messageBarActionsClassNames.root` in `MessageBar.parts.tsx` and `messageBarClassNames.root` in `MessageBar.tsx`. `exportDocblocks` checks the new compound: the docblock is on the `Object.assign` const and `MessageBarRoot` has none. `classNames.test.ts` skips the two Phase 3 constants through `PENDING_CLASS_NAMES`, and `public-types.test.ts` skips `MessageBarTitleProps` and `MessageBarActionsProps` through `PENDING_PUBLIC_TYPES` (both lists are Task A1/A15's). `build-css` proves no comment word of the new module generates a utility.

- [ ] **Step 9: Commit**

```bash
git add src/components/feedback/MessageBar.parts.tsx src/components/feedback/MessageBar.tsx src/components/feedback/__tests__/MessageBar.parts.test.tsx
git commit -m "feat(feedback): MessageBar.Title and MessageBar.Actions parts"
```

---

### Task M2: A titled bar with a non-live role is named by its title

**Files:**
- Modify: `src/components/feedback/MessageBar.tsx` (module-level helpers; the root's labelling; the `StatusText` and root attributes)
- Test: `src/components/feedback/__tests__/MessageBar.parts.test.tsx`

**Interfaces:**
- Consumes: `StatusText({ label, id }: { label: string; id?: string })` (Task A3); `joinIds(...ids)` from `src/lib/aria.ts`; `partitionMessageBarChildren` and `titleId` (Task M1).
- Produces: `aria-labelledby` = the severity text's id and the title's id on a bar whose rendered role is not a live-region role (`alert`, `status`, `log`, `marquee`, `timer`) nor a role that takes no name (`none`, `presentation`, `generic`), while a title is placed and the consumer passes no `aria-label`/`aria-labelledby` of their own; warning key `MessageBar:region-name`.

- [ ] **Step 1: Write the failing tests**

In `MessageBar.parts.test.tsx`, extend the imports:

```tsx
import { render, screen, within } from '@testing-library/react';
```

```tsx
import {
  asClientReference,
  expectNoA11yViolations,
  expectThrows,
  findDanglingIdRefs,
  findDanglingIdRefsInHtml,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';
```

Add below `TITLE_MULTIPLE`:

```tsx
const REGION_NAME =
  '[WaveUI] MessageBar: a bar with role="region" is a landmark only when it has a name. Add a MessageBar.Title, or pass aria-label or aria-labelledby.';
```

Add inside `describe('MessageBar parts (P3-04)')`, after `describe('misplaced parts')`:

```tsx
  describe('labelling (D16)', () => {
    it('a live bar is not named by its title; the severity and the title are read first in its content', () => {
      render(
        <MessageBar status="warning">
          <MessageBar.Title>Update available</MessageBar.Title>A new version is ready to install.
        </MessageBar>,
      );
      const bar = screen.getByRole('alert');
      expect(bar).not.toHaveAttribute('aria-labelledby');
      expect(bar).toHaveAccessibleName('');
      expect(textColumn(bar)).toHaveTextContent(
        /^Warning:\s*Update available A new version is ready to install\.$/,
      );
      expect(within(bar).getByText('Warning:')).not.toHaveAttribute('id');
    });

    it.each(['region', 'group'] as const)(
      'a bar with role="%s" is named by the severity and the title',
      (role) => {
        render(
          <MessageBar status="warning" role={role}>
            <MessageBar.Title>Update available</MessageBar.Title>
            Install it tonight.
          </MessageBar>,
        );
        expect(screen.getByRole(role, { name: 'Warning: Update available' })).toBeInTheDocument();
        expect(findDanglingIdRefs()).toEqual([]);
      },
    );

    it('names the bar through the consumer id of the title', () => {
      render(
        <MessageBar role="region">
          <MessageBar.Title id="release-title">Release 4.2</MessageBar.Title>
          Notes below.
        </MessageBar>,
      );
      const bar = screen.getByRole('region', { name: 'Info: Release 4.2' });
      expect(bar.getAttribute('aria-labelledby')?.split(' ')).toContain('release-title');
    });

    it('leaves the severity out of the name when statusLabel is empty', () => {
      render(
        <MessageBar status="warning" statusLabel="" role="region">
          <MessageBar.Title id="t">Update available</MessageBar.Title>
          Install it tonight.
        </MessageBar>,
      );
      expect(screen.getByRole('region', { name: 'Update available' })).toHaveAttribute(
        'aria-labelledby',
        't',
      );
    });

    it('lets a consumer aria-label or aria-labelledby win', () => {
      const { unmount } = render(
        <MessageBar role="region" aria-label="Release notes">
          <MessageBar.Title>Update available</MessageBar.Title>
          Install it tonight.
        </MessageBar>,
      );
      expect(screen.getByRole('region', { name: 'Release notes' })).not.toHaveAttribute(
        'aria-labelledby',
      );
      unmount();

      render(
        <>
          <h2 id="notes-heading">Notes</h2>
          <MessageBar role="region" aria-labelledby="notes-heading">
            <MessageBar.Title>Update available</MessageBar.Title>
            Install it tonight.
          </MessageBar>
        </>,
      );
      expect(screen.getByRole('region', { name: 'Notes' })).toHaveAttribute(
        'aria-labelledby',
        'notes-heading',
      );
    });

    it('a forwarded aria-label={undefined} is not a name of the consumer', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar role="region" aria-label={undefined} aria-labelledby={undefined}>
          <MessageBar.Title>Update available</MessageBar.Title>
          Install it tonight.
        </MessageBar>,
      );
      expect(screen.getByRole('region', { name: 'Info: Update available' })).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });

    it('warns once about a region bar without a name', () => {
      const warn = spyOnWarn();
      render(<MessageBar role="region">Maintenance tonight.</MessageBar>);
      expect(warn.mock.calls).toEqual([[REGION_NAME]]);
    });

    it('does not warn about a region bar named by its title or by the consumer', () => {
      const warn = spyOnWarn();
      render(
        <>
          <MessageBar role="region">
            <MessageBar.Title>Maintenance</MessageBar.Title>
            Tonight.
          </MessageBar>
          <MessageBar role="region" aria-label="Maintenance">
            Tonight.
          </MessageBar>
        </>,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('an empty title names nothing, so a region bar warns', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar role="region">
          <MessageBar.Title>{''}</MessageBar.Title>
          Tonight.
        </MessageBar>,
      );
      expect(screen.getByRole('region')).not.toHaveAttribute('aria-labelledby');
      expect(warn.mock.calls).toEqual([[REGION_NAME]]);
    });

    it('the server HTML of a titled region bar references only ids it contains', () => {
      const html = renderToString(
        <MessageBar role="region" status="error">
          <MessageBar.Title>Sync paused</MessageBar.Title>
          Reconnect to continue.
        </MessageBar>,
      );
      expect(html).toContain('aria-labelledby=');
      expect(findDanglingIdRefsInHtml(html)).toEqual([]);
    });

    it('has no accessibility violations: a region bar with a title and actions', async () => {
      render(
        <MessageBar role="region" status="warning" onDismiss={() => {}}>
          <MessageBar.Title>Maintenance tonight</MessageBar.Title>
          The service is unavailable from 22:00 to 23:00 UTC.
          <MessageBar.Actions>
            <Button>Details</Button>
          </MessageBar.Actions>
        </MessageBar>,
      );
      await expectNoA11yViolations();
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/MessageBar.parts.test.tsx -t "labelling"`
Expected: FAIL — `getByRole('region', { name: 'Warning: Update available' })` finds no region with that name (the bar has no `aria-labelledby`), `warn.mock.calls` is `[]` where `REGION_NAME` is expected, and the server HTML has no `aria-labelledby`. The live-bar case, the consumer-label cases and the no-warning case already pass.

- [ ] **Step 3: Add the role helpers to `MessageBar.tsx`**

Add after `const dismissContentClassName = 'inline-flex items-center justify-center';`:

```tsx
/** Live-region roles: a title is read as the start of their content, never as their name. */
const LIVE_REGION_ROLES: ReadonlySet<string> = new Set([
  'alert',
  'status',
  'log',
  'marquee',
  'timer',
]);

/** Roles that take no name. */
const UNNAMED_ROLES: ReadonlySet<string> = new Set(['none', 'presentation', 'generic']);

/** The first token of a `role` value (a list of fallback roles is read by its first). */
function firstRoleToken(role: string | undefined): string | undefined {
  return role?.trim().split(/\s+/)[0] || undefined;
}

/** Whether a title names a bar with this role (spec D16: a non-live role, such as region or group). */
function isNamedByTitle(role: string | undefined): boolean {
  const token = firstRoleToken(role);
  return token !== undefined && !LIVE_REGION_ROLES.has(token) && !UNNAMED_ROLES.has(token);
}
```

- [ ] **Step 4: Label the bar**

In the root, directly after the `titlePlacement` memo of Task M1, add:

```tsx
  // Labelling (D16). The role the bar renders: the consumer's when the prop is given (it is spread
  // after the default, as in 0.7), else the status role. A live bar is read once, title included,
  // and gets no name; a bar with a non-live role is named by the severity text and the title.
  const defaultRole = status === 'error' || status === 'warning' ? 'alert' : 'status';
  const role = 'role' in rest ? rest.role : defaultRole;
  // A prop that holds `undefined` (a wrapper forwarding it) is no name of the consumer's.
  const ownName = rest['aria-label'] !== undefined || rest['aria-labelledby'] !== undefined;
  const statusText = getStatusLabel(status, statusLabel);
  const statusTextId = useId('wave-message-bar-status');
  const namedByTitle = title !== undefined && !ownName && isNamedByTitle(role);
  // Written after the spread, so a forwarded `aria-labelledby={undefined}` cannot remove it.
  const labelledBy = ownName
    ? rest['aria-labelledby']
    : namedByTitle
      ? joinIds(statusText ? statusTextId : undefined, titleId)
      : undefined;
  const missingRegionName = firstRoleToken(role) === 'region' && title === undefined && !ownName;
  React.useEffect(() => {
    if (missingRegionName) {
      warnOnce(
        'MessageBar:region-name',
        'MessageBar: a bar with role="region" is a landmark only when it has a name. Add a MessageBar.Title, or pass aria-label or aria-labelledby.',
      );
    }
  }, [missingRegionName]);
```

Add the import:

```tsx
import { joinIds } from '../../lib/aria';
```

In the text column, replace:

```tsx
      <StatusText label={getStatusLabel(status, statusLabel)} />
```

with (the id only on a named bar, so every other bar keeps 0.7's markup):

```tsx
      <StatusText id={namedByTitle && statusText ? statusTextId : undefined} label={statusText} />
```

In the root element, replace:

```tsx
      ref={ref}
      role={status === 'error' || status === 'warning' ? 'alert' : 'status'}
      {...rest}
      className={cn(
```

with:

```tsx
      ref={ref}
      role={defaultRole}
      {...rest}
      aria-labelledby={labelledBy}
      className={cn(
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/feedback/__tests__/MessageBar.parts.test.tsx src/components/feedback/__tests__/MessageBar.test.tsx --reporter=default`
Expected: PASS, clean output (the 0.7 suite's `lets a consumer role override the default` still passes: `role` is spread after the default).

- [ ] **Step 6: Quick checks**

```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/components/feedback/MessageBar.tsx src/components/feedback/__tests__/MessageBar.parts.test.tsx --max-warnings 0
npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/MessageBar"
node scripts/build-css.mjs
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/feedback/MessageBar.tsx src/components/feedback/__tests__/MessageBar.parts.test.tsx
git commit -m "feat(feedback): name a MessageBar with a non-live role by its title"
```

---

### Task M3: `layout` and `data-layout` on one DOM order

**Files:**
- Modify: `src/components/feedback/MessageBar.tsx` (`MessageBarProps`; the root's destructuring, layout resolution, root attributes and the layout wrapper)
- Test: `src/components/feedback/__tests__/MessageBar.parts.test.tsx`, `src/components/feedback/__tests__/MessageBar.test.tsx`

**Interfaces:**
- Consumes: `partitionMessageBarChildren` (`actions`) from Task M1.
- Produces: `MessageBarProps['layout']: 'auto' | 'singleline' | 'multiline' | undefined` (default `'auto'`); `data-layout="singleline" | "multiline"` on every root, before `{...rest}`. In this task `'auto'` resolves to `'multiline'` without actions and to `'singleline'` with actions (Task M4 makes the latter measured).

- [ ] **Step 1: Write the failing tests**

In `MessageBar.test.tsx`, add inside `describe('MessageBar')`, after the `declares ref in the props interface` test:

```tsx
  describe('layout (P3-04)', () => {
    it('renders data-layout="multiline" by default and keeps the 0.7 markup of a bar without actions', () => {
      render(
        <MessageBar onDismiss={() => {}} data-testid="bar">
          Msg
        </MessageBar>,
      );
      const bar = screen.getByTestId('bar');
      expect(bar).toHaveAttribute('data-layout', 'multiline');
      expect(Array.from(bar.children, (child) => child.tagName)).toEqual(['SPAN', 'DIV', 'BUTTON']);
      expect(bar.children[1]).toHaveClass('min-w-0', 'flex-1', 'text-body-1');
      expect(bar.children[1]).not.toHaveClass('whitespace-nowrap');
    });

    it('an explicit singleline bar without actions renders the same markup', () => {
      const { container, rerender } = render(<MessageBar onDismiss={() => {}}>Msg</MessageBar>);
      const auto = container.innerHTML.replace('data-layout="multiline"', '');
      rerender(
        <MessageBar layout="singleline" onDismiss={() => {}}>
          Msg
        </MessageBar>,
      );
      expect(screen.getByRole('status')).toHaveAttribute('data-layout', 'singleline');
      expect(container.innerHTML.replace('data-layout="singleline"', '')).toBe(auto);
    });

    it('types layout as a union', () => {
      expectTypeOf<MessageBarProps['layout']>().toEqualTypeOf<
        'auto' | 'singleline' | 'multiline' | undefined
      >();
      const elements = [
        // @ts-expect-error `wrap` is not a layout
        <MessageBar key="1" layout="wrap">
          Msg
        </MessageBar>,
      ];
      expect(elements).toHaveLength(1);
    });
  });
```

In `MessageBar.parts.test.tsx`, extend the imports:

```tsx
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MessageBarActionsProps, MessageBarProps, MessageBarTitleProps } from '../MessageBar';
```

and add `renderWithProviders` to the `test-utils` import list. Add at module level, below `actionsOf`:

```tsx
const statuses = ['info', 'success', 'warning', 'error'] as const;
const layouts = ['singleline', 'multiline'] as const;

/** Classes that cut text off; no layout may put them on the text column (D17, WCAG 1.4.10). */
const CLIPPING_CLASSES = ['truncate', 'text-ellipsis', 'text-clip', 'overflow-hidden', 'line-clamp-1'];

/** A bar with a title, a link in its text, two actions and the Dismiss button. */
function FullBar({
  layout,
  status,
}: {
  layout?: MessageBarProps['layout'];
  status?: MessageBarProps['status'];
}) {
  return (
    <MessageBar layout={layout} status={status} onDismiss={() => {}}>
      <MessageBar.Title>Update available</MessageBar.Title>
      Read the <a href="#notes">release notes</a>.
      <MessageBar.Actions>
        <Button>Update now</Button>
        <Button>Later</Button>
      </MessageBar.Actions>
    </MessageBar>
  );
}
```

Add inside `describe('MessageBar parts (P3-04)')`, after `describe('labelling (D16)')`:

```tsx
  describe('layouts (D17)', () => {
    it.each([
      ['auto without actions', 'multiline', undefined, false],
      ['singleline without actions', 'singleline', 'singleline', false],
      ['multiline without actions', 'multiline', 'multiline', false],
      ['auto with actions, first render', 'singleline', undefined, true],
      ['singleline with actions', 'singleline', 'singleline', true],
      ['multiline with actions', 'multiline', 'multiline', true],
    ] as const)('%s: data-layout="%s"', (_label, expected, layout, withActions) => {
      render(
        <MessageBar layout={layout}>
          Body
          {withActions && (
            <MessageBar.Actions>
              <Button>Retry</Button>
            </MessageBar.Actions>
          )}
        </MessageBar>,
      );
      expect(screen.getByRole('status')).toHaveAttribute('data-layout', expected);
    });

    it.each(layouts)('keeps one DOM order in the %s layout: icon, text, actions, Dismiss', (layout) => {
      render(<FullBar layout={layout} />);
      const bar = screen.getByRole('status');
      const icon = bar.querySelector<HTMLElement>(`.${messageBarClassNames.icon}`);
      expect(icon).not.toBeNull();
      const order = [
        icon!,
        textColumn(bar),
        actionsOf(screen.getByRole('button', { name: 'Update now' })),
        screen.getByRole('button', { name: 'Dismiss' }),
      ];
      for (let i = 1; i < order.length; i++) {
        expect(
          order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    });

    it.each(layouts)('tabs through the text, the actions and Dismiss in the %s layout', async (layout) => {
      const user = userEvent.setup();
      render(<FullBar layout={layout} />);
      await user.tab();
      expect(screen.getByRole('link', { name: 'release notes' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Update now' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Later' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveFocus();
    });

    it('stacks the actions under the text only in the multiline layout', () => {
      const { rerender } = render(<FullBar layout="singleline" />);
      const actions = actionsOf(screen.getByRole('button', { name: 'Update now' }));
      expect(actions.parentElement).not.toHaveClass('flex-col');
      rerender(<FullBar layout="multiline" />);
      expect(actions.parentElement).toHaveClass('flex-col');
    });

    it('keeps the focused action when the layout changes (nothing moves in the DOM)', () => {
      const { rerender } = render(<FullBar layout="singleline" />);
      const action = screen.getByRole('button', { name: 'Update now' });
      act(() => action.focus());
      rerender(<FullBar layout="multiline" />);
      expect(screen.getByRole('button', { name: 'Update now' })).toBe(action);
      expect(action).toHaveFocus();
    });

    it.each(layouts)('never cuts the text off and uses no inline style (%s)', (layout) => {
      render(<FullBar layout={layout} />);
      const bar = screen.getByRole('status');
      const text = textColumn(bar);
      expect(text).not.toHaveClass('whitespace-nowrap');
      for (const cls of CLIPPING_CLASSES) expect(text).not.toHaveClass(cls);
      expect(bar).not.toHaveAttribute('style');
      expect(bar.querySelectorAll('[style]')).toHaveLength(0);
    });

    it('places the actions and the Dismiss button at the end in RTL', () => {
      renderWithProviders(<FullBar layout="singleline" />, { dir: 'rtl' });
      const bar = screen.getByRole('status');
      expect(bar.closest('[dir]')).toHaveAttribute('dir', 'rtl');
      const dismiss = screen.getByRole('button', { name: 'Dismiss' });
      expect(dismiss).toHaveClass('ms-auto');
      const actions = actionsOf(screen.getByRole('button', { name: 'Update now' }));
      expect(
        textColumn(bar).compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it.each(statuses.flatMap((status) => layouts.map((layout) => [status, layout] as const)))(
      'has no accessibility violations: %s bar with a title and actions (%s)',
      async (status, layout) => {
        render(<FullBar status={status} layout={layout} />);
        await expectNoA11yViolations();
      },
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/MessageBar.parts.test.tsx src/components/feedback/__tests__/MessageBar.test.tsx -t "layout"`
Expected: FAIL — every `data-layout` assertion fails (the attribute is missing), and `stacks the actions under the text only in the multiline layout` fails (the wrapper never gets `flex-col`). `npx tsc -p tsconfig.dev.json --noEmit` also fails: `MessageBarProps['layout']` and the `layout` prop do not exist yet.

- [ ] **Step 3: Add the `layout` prop**

In `MessageBarProps`, add directly above the JSDoc of `children` (the one Task M1 wrote, beginning "The message: body text"):

```tsx
  /**
   * How the text and the actions share the bar. `'singleline'`: the actions sit on the text's row
   * (the text wraps inside its column; it is never cut off). `'multiline'`: the actions get a row of
   * their own under the text. `'auto'`: the actions stay on the text's row while the text fits on
   * one line, measured after mount (the server renders one row), and move below it otherwise; a bar
   * without `MessageBar.Actions` is `'multiline'`, the 0.7 look. The root renders the layout in use
   * as `data-layout` (`singleline` or `multiline`). Fluent's `layout`.
   * @default 'auto'
   */
  layout?: 'auto' | 'singleline' | 'multiline';
```

In the root's destructuring, add `layout = 'auto',` after `dismiss,`.

- [ ] **Step 4: Resolve the layout and switch the classes**

Directly after the labelling block of Task M2, add:

```tsx
  // Layout (D17): one DOM order in every layout (icon, text, actions, Dismiss), so a layout change
  // never moves a focused element; only classes change. Without actions the bar keeps 0.7's markup.
  const hasActions = actions.length > 0;
  const resolvedLayout: 'singleline' | 'multiline' =
    layout === 'auto' ? (hasActions ? 'singleline' : 'multiline') : layout;
```

In the root element, add `data-layout` before the spread:

```tsx
      ref={ref}
      role={defaultRole}
      data-layout={resolvedLayout}
      {...rest}
      aria-labelledby={labelledBy}
```

Replace the layout wrapper of Task M1:

```tsx
          <div className="flex min-w-0 flex-1 items-start gap-x-3 gap-y-2">
```

with:

```tsx
          <div
            className={cn(
              'flex min-w-0 flex-1 gap-x-3 gap-y-2',
              resolvedLayout === 'multiline' ? 'flex-col' : 'items-start',
            )}
          >
```

and its condition `actions.length > 0 ?` with `hasActions ?`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/feedback/__tests__/MessageBar.parts.test.tsx src/components/feedback/__tests__/MessageBar.test.tsx --reporter=default`
Expected: PASS, clean output. The §6.4 pins stay green unchanged: `icon={null} renders no icon` (`:169`) and the RTL `ms-auto` check (`:1352`).

- [ ] **Step 6: Quick checks**

```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/components/feedback/MessageBar.tsx src/components/feedback/__tests__/MessageBar.parts.test.tsx src/components/feedback/__tests__/MessageBar.test.tsx --max-warnings 0
npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/MessageBar"
npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Feedback/MessageBar"
```

Expected: all pass (`tsc -p tsconfig.dev.json` accepts the `@ts-expect-error` now that `layout` is a union).

- [ ] **Step 7: Commit**

```bash
git add src/components/feedback/MessageBar.tsx src/components/feedback/__tests__/MessageBar.parts.test.tsx src/components/feedback/__tests__/MessageBar.test.tsx
git commit -m "feat(feedback): MessageBar layout prop and data-layout"
```

---

### Task M4: The `'auto'` reflow

**Files:**
- Create: `src/components/feedback/MessageBar.reflow.ts`
- Modify: `src/components/feedback/MessageBar.tsx` (element state, the hook call, the unwrapped text column)
- Test: `src/components/feedback/__tests__/MessageBar.reflow.test.tsx` (create)

**Interfaces:**
- Consumes: `installResizeObserverMock`, `ResizeObserverMock`, `mockRect` (`src/test-utils.ts`); `useMergedRefs` (`src/hooks/useMergedRefs.ts`); `hasActions`/`resolvedLayout` (Task M3).
- Produces (internal, `MessageBar.reflow.ts`): `export type MessageBarReflowLayout = 'singleline' | 'multiline'`; `export function useMessageBarReflow(root: HTMLElement | null, text: HTMLElement | null, enabled: boolean): MessageBarReflowLayout`. `'auto'` with actions renders the one-row layout on the server and on the first client render, its text column `whitespace-nowrap` (not clipped) while it measures one row.

- [ ] **Step 1: Write the failing tests**

Create `src/components/feedback/__tests__/MessageBar.reflow.test.tsx`:

```tsx
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MessageBar } from '../MessageBar';
import type { MessageBarProps } from '../MessageBar';
import { Button } from '../../button/Button';
import { messageBarClassNames } from '../../../lib/classNames';
import { installResizeObserverMock, mockRect } from '../../../test-utils';
import type { ResizeObserverMock } from '../../../test-utils';

/** Resolves after the next animation frame (the reflow measures a resize one frame later). */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Classes that cut text off; no layout may put them on the text column (D17, WCAG 1.4.10). */
const CLIPPING_CLASSES = ['truncate', 'text-ellipsis', 'text-clip', 'overflow-hidden', 'line-clamp-1'];

/** An `'auto'` bar (unless `layout` says otherwise) with a Retry action (unless `actions` is false). */
function ReflowBar({
  layout,
  actions = true,
  children = 'Your session expires in five minutes.',
}: {
  layout?: MessageBarProps['layout'];
  actions?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <MessageBar layout={layout}>
      {children}
      {actions && (
        <MessageBar.Actions>
          <Button>Retry</Button>
        </MessageBar.Actions>
      )}
    </MessageBar>
  );
}

/** Text that changes without a render of the bar (a live progress message). */
interface LiveMessageHandle {
  set(message: string): void;
}
function LiveMessage({ ref }: { ref: React.Ref<LiveMessageHandle> }) {
  const [message, setMessage] = React.useState('Uploading…');
  React.useImperativeHandle(ref, () => ({ set: setMessage }), []);
  return <>{message}</>;
}

function textColumn(bar: HTMLElement): HTMLElement {
  const column = bar.querySelector<HTMLElement>(`.${messageBarClassNames.body}`);
  if (!column) throw new Error('the bar has no text column');
  return column;
}

/**
 * Gives the bar and its text column the widths of a real layout (jsdom lays nothing out): `root`
 * is the bar's client width, `text` the column's client width and `content` its scroll width.
 */
function setWidths(
  bar: HTMLElement,
  { root, text, content }: { root: number; text: number; content: number },
): void {
  mockRect(bar, { width: root });
  const column = textColumn(bar);
  mockRect(column, { width: text });
  Object.defineProperty(column, 'scrollWidth', { configurable: true, value: content });
}

describe('MessageBar reflow (D17)', () => {
  let ro: ResizeObserverMock;

  beforeEach(() => {
    ro = installResizeObserverMock();
  });

  afterEach(() => {
    ro.restore();
    vi.restoreAllMocks();
  });

  /** Reports a resize of the bar and lets the measurement of the next frame land. */
  async function resize(bar: HTMLElement): Promise<void> {
    ro.trigger(bar);
    await act(async () => {
      await nextFrame();
    });
  }

  it("does not observe a bar without actions ('auto' is multiline)", () => {
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    render(<ReflowBar actions={false} />);
    expect(screen.getByRole('status')).toHaveAttribute('data-layout', 'multiline');
    expect(observe).not.toHaveBeenCalled();
  });

  it('does not observe a bar whose actions render nothing', () => {
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    render(
      <MessageBar>
        Body
        <MessageBar.Actions>{false}</MessageBar.Actions>
      </MessageBar>,
    );
    expect(screen.getByRole('status')).toHaveAttribute('data-layout', 'multiline');
    expect(observe).not.toHaveBeenCalled();
  });

  it('never observes an explicit layout', () => {
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    const { rerender } = render(<ReflowBar layout="singleline" />);
    rerender(<ReflowBar layout="multiline" />);
    expect(observe).not.toHaveBeenCalled();
  });

  it('observes the root of an auto bar with actions and starts with one row', () => {
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    render(<ReflowBar />);
    const bar = screen.getByRole('status');
    expect(bar).toHaveAttribute('data-layout', 'singleline');
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(bar, { box: 'border-box' });
  });

  it('switches to multiline while the text overflows and back once the bar is as wide as the text needed', async () => {
    render(<ReflowBar />);
    const bar = screen.getByRole('status');
    // The text needs 150 px more than its column, so the bar needs 400 + 150 = 550 px.
    setWidths(bar, { root: 400, text: 200, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    setWidths(bar, { root: 549, text: 349, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    setWidths(bar, { root: 550, text: 350, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'singleline');
  });

  it('keeps the text column unwrapped only while it measures one row, and never cuts it off', async () => {
    render(<ReflowBar />);
    const bar = screen.getByRole('status');
    expect(textColumn(bar)).toHaveClass('whitespace-nowrap');
    for (const cls of CLIPPING_CLASSES) expect(textColumn(bar)).not.toHaveClass(cls);

    setWidths(bar, { root: 400, text: 200, content: 350 });
    await resize(bar);
    expect(textColumn(bar)).not.toHaveClass('whitespace-nowrap');
    for (const cls of CLIPPING_CLASSES) expect(textColumn(bar)).not.toHaveClass(cls);
  });

  it('keeps focus on an action through a reflow', async () => {
    render(<ReflowBar />);
    const bar = screen.getByRole('status');
    const action = screen.getByRole('button', { name: 'Retry' });
    act(() => action.focus());
    setWidths(bar, { root: 400, text: 200, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');
    expect(screen.getByRole('button', { name: 'Retry' })).toBe(action);
    expect(action).toHaveFocus();
  });

  it('attaches and detaches the observer as actions come and go, with no stale multiline state', async () => {
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    const disconnect = vi.spyOn(globalThis.ResizeObserver.prototype, 'disconnect');
    const { rerender } = render(<ReflowBar actions={false} />);
    const bar = screen.getByRole('status');
    expect(bar).toHaveAttribute('data-layout', 'multiline');
    expect(observe).not.toHaveBeenCalled();

    rerender(<ReflowBar />);
    expect(bar).toHaveAttribute('data-layout', 'singleline');
    expect(observe).toHaveBeenCalledTimes(1);
    setWidths(bar, { root: 400, text: 200, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    rerender(<ReflowBar actions={false} />);
    expect(bar).toHaveAttribute('data-layout', 'multiline');
    expect(disconnect).toHaveBeenCalledTimes(1);

    rerender(<ReflowBar />);
    // Measured again from one row: the new text column fits, so the old measurement is gone.
    expect(bar).toHaveAttribute('data-layout', 'singleline');
    expect(observe).toHaveBeenCalledTimes(2);
  });

  it('starts over when the layout changes back to auto', async () => {
    const disconnect = vi.spyOn(globalThis.ResizeObserver.prototype, 'disconnect');
    const { rerender } = render(<ReflowBar />);
    const bar = screen.getByRole('status');
    setWidths(bar, { root: 400, text: 200, content: 350 }); // needs 550 px
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    rerender(<ReflowBar layout="singleline" />);
    expect(bar).toHaveAttribute('data-layout', 'singleline');
    expect(disconnect).toHaveBeenCalledTimes(1);

    // The text got shorter meanwhile: it fits the 400 px bar, narrower than the 550 px measured before.
    setWidths(bar, { root: 400, text: 200, content: 150 });
    rerender(<ReflowBar layout="auto" />);
    expect(bar).toHaveAttribute('data-layout', 'singleline');
  });

  it('re-measures when the text changes inside the column without a render of the bar', async () => {
    const live = React.createRef<LiveMessageHandle>();
    render(
      <ReflowBar>
        <LiveMessage ref={live} />
      </ReflowBar>,
    );
    const bar = screen.getByRole('status');
    expect(bar).toHaveAttribute('data-layout', 'singleline');

    setWidths(bar, { root: 400, text: 200, content: 350 });
    await act(async () => {
      live.current?.set('Uploading 3 of 10 files to the shared team folder…');
    });
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    setWidths(bar, { root: 400, text: 200, content: 150 });
    await act(async () => {
      live.current?.set('Upload done');
    });
    expect(bar).toHaveAttribute('data-layout', 'singleline');
  });

  it('leaves one observer on the root in StrictMode', () => {
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    const disconnect = vi.spyOn(globalThis.ResizeObserver.prototype, 'disconnect');
    render(
      <React.StrictMode>
        <ReflowBar />
      </React.StrictMode>,
    );
    const bar = screen.getByRole('status');
    expect(observe).toHaveBeenCalledWith(bar, { box: 'border-box' });
    // StrictMode runs the effects twice: every observer but one is disconnected again.
    expect(observe.mock.calls.length - disconnect.mock.calls.length).toBe(1);
  });

  it('renders one row on the server and hydrates without warnings', async () => {
    expect(renderToString(<MessageBar>Msg</MessageBar>)).toContain('data-layout="multiline"');
    const ui = (
      <MessageBar status="warning" onDismiss={() => {}}>
        <MessageBar.Title>Update available</MessageBar.Title>A new version is ready to install.
        <MessageBar.Actions>
          <Button>Update now</Button>
        </MessageBar.Actions>
      </MessageBar>
    );
    const html = renderToString(ui);
    expect(html).toContain('data-layout="singleline"');
    expect(html).toContain('whitespace-nowrap');

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, ui);
      });
      expect(container.querySelector('[data-layout]')).toHaveAttribute('data-layout', 'singleline');
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});

describe('MessageBar reflow without ResizeObserver', () => {
  it('renders one row, measures after each render of the bar and follows window resizes', () => {
    expect(typeof globalThis.ResizeObserver).toBe('undefined');
    const { rerender } = render(<ReflowBar />);
    const bar = screen.getByRole('status');
    expect(bar).toHaveAttribute('data-layout', 'singleline');

    // A render of the bar measures before paint. The same text keeps the DOM unchanged, so no
    // MutationObserver record reaches the store after this synchronous act().
    setWidths(bar, { root: 400, text: 200, content: 350 });
    rerender(<ReflowBar />);
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    setWidths(bar, { root: 600, text: 400, content: 350 });
    fireEvent(window, new Event('resize'));
    expect(bar).toHaveAttribute('data-layout', 'singleline');

    setWidths(bar, { root: 400, text: 200, content: 350 });
    fireEvent(window, new Event('resize'));
    expect(bar).toHaveAttribute('data-layout', 'multiline');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/feedback/__tests__/MessageBar.reflow.test.tsx`
Expected: FAIL — `observe` is never called (nothing observes the bar), `data-layout` stays `singleline` after an overflowing resize or render, and the server HTML has no `whitespace-nowrap`. The three "does not observe"/"never observes" cases already pass.

- [ ] **Step 3: Create `src/components/feedback/MessageBar.reflow.ts`**

```ts
import * as React from 'react';

/** The layout an `'auto'` MessageBar with actions renders. */
export type MessageBarReflowLayout = 'singleline' | 'multiline';

/**
 * One bar's measurement (spec D17): whether its text needs the multiline layout, and the bar width
 * at which the text fits on one line again. Read through `useSyncExternalStore`.
 */
class MessageBarReflowStore {
  private reflowing = false;
  /** The bar's client width at which its text fits on one line. */
  private neededWidth = 0;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): MessageBarReflowLayout => (this.reflowing ? 'multiline' : 'singleline');

  /** The server HTML and hydration use the one-row layout. */
  getServerSnapshot = (): MessageBarReflowLayout => 'singleline';

  /**
   * The two-way rule. One row: text wider than its column (`scrollWidth > clientWidth`; the column
   * does not wrap while measured) switches to multiline and remembers the bar width it needed,
   * `root.clientWidth + text.scrollWidth - text.clientWidth`. Multiline: a bar at least that wide
   * switches back.
   */
  measure(root: HTMLElement, text: HTMLElement): void {
    if (this.reflowing) {
      if (root.clientWidth < this.neededWidth) return;
      this.reflowing = false;
      this.neededWidth = 0;
    } else {
      const overflow = text.scrollWidth - text.clientWidth;
      if (overflow <= 0) return;
      this.reflowing = true;
      this.neededWidth = root.clientWidth + overflow;
    }
    this.emit();
  }

  /** Forgets the measurement: the next render uses the one-row layout and measures again. */
  reset(): void {
    if (!this.reflowing) return;
    this.reflowing = false;
    this.neededWidth = 0;
    this.emit();
  }

  /**
   * Observes `root` and `text` until the returned teardown runs, which also forgets the
   * measurement.
   * - The root's size (a ResizeObserver): measured in the next animation frame, so the layout
   *   change never resizes the observed root while the observer is still delivering (browsers
   *   report that as a loop error). Without ResizeObserver: window size changes.
   * - Text changed inside the column without a render of the bar (a MutationObserver): measured at
   *   once in the one-row layout; in the multiline layout the measurement starts over from the
   *   one-row layout (the render that follows measures before paint).
   */
  connect(root: HTMLElement, text: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];
    const measure = () => this.measure(root, text);
    if (typeof ResizeObserver !== 'undefined') {
      let frame = 0;
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(measure);
      });
      observer.observe(root, { box: 'border-box' });
      cleanups.push(() => {
        observer.disconnect();
        cancelAnimationFrame(frame);
      });
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
      cleanups.push(() => window.removeEventListener('resize', measure));
    }
    if (typeof MutationObserver !== 'undefined') {
      const mutations = new MutationObserver(() => {
        if (this.reflowing) this.reset();
        else measure();
      });
      mutations.observe(text, { childList: true, subtree: true, characterData: true });
      cleanups.push(() => mutations.disconnect());
    }
    return () => {
      for (const cleanup of cleanups) cleanup();
      this.reset();
    };
  }

  private emit(): void {
    for (const listener of Array.from(this.listeners)) listener();
  }
}

/**
 * The layout of a MessageBar with `layout="auto"` and actions: `'singleline'` on the server, on the
 * first client render and while the text fits on one line; `'multiline'` otherwise. `root` is the
 * bar's root element and `text` its text column, both held in state through callback refs
 * (C-POPUPS). With `enabled` false (every other bar) nothing is observed or measured and the result
 * is `'singleline'`.
 */
export function useMessageBarReflow(
  root: HTMLElement | null,
  text: HTMLElement | null,
  enabled: boolean,
): MessageBarReflowLayout {
  const [store] = React.useState(() => new MessageBarReflowStore());
  const layout = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const [, forceRender] = React.useReducer((count: number) => count + 1, 0);

  // The observers follow the elements. Their teardown forgets the measurement, so a bar that
  // measures again (its actions back, or `layout` back to 'auto') starts from one row.
  React.useLayoutEffect(() => {
    if (!enabled || !root || !text) return undefined;
    return store.connect(root, text);
  }, [store, enabled, root, text]);

  // After every commit in the one-row layout, before paint: useSyncExternalStore subscribes only in
  // a passive effect, which can run after the browser painted, so a change found here re-renders
  // through `forceRender` (the pattern of Overflow's `useIsOverflowing`).
  React.useLayoutEffect(() => {
    if (!enabled || !root || !text || store.getSnapshot() !== 'singleline') return;
    const unsubscribe = store.subscribe(forceRender);
    store.measure(root, text);
    unsubscribe();
  });

  return enabled ? layout : 'singleline';
}
```

- [ ] **Step 4: Measure in `MessageBar.tsx`**

Add the import:

```tsx
import { useMessageBarReflow } from './MessageBar.reflow';
```

Replace the layout block of Task M3:

```tsx
  const hasActions = actions.length > 0;
  const resolvedLayout: 'singleline' | 'multiline' =
    layout === 'auto' ? (hasActions ? 'singleline' : 'multiline') : layout;
```

with:

```tsx
  const hasActions = actions.length > 0;
  // `'auto'` with actions measures its text (MessageBar.reflow.ts); the elements it reads are held
  // in state through callback refs, attached only while it measures (no extra render otherwise).
  const measuring = layout === 'auto' && hasActions;
  const [rootElement, setRootElement] = React.useState<HTMLDivElement | null>(null);
  const [textElement, setTextElement] = React.useState<HTMLDivElement | null>(null);
  const rootRef = useMergedRefs<HTMLDivElement>(ref, measuring ? setRootElement : undefined);
  const measuredLayout = useMessageBarReflow(rootElement, textElement, measuring);
  const resolvedLayout: 'singleline' | 'multiline' =
    layout === 'auto' ? (hasActions ? measuredLayout : 'multiline') : layout;
  // While it measures one row, the text column does not wrap, so text that does not fit overflows
  // the column (never cut off) and the measurement sees it.
  const unwrapped = measuring && resolvedLayout === 'singleline';
```

The `text` constant of Task M1 sits below this block (Tasks M2 and M3 inserted their blocks above it), so it can read `unwrapped` and `setTextElement`. Change its opening tag from:

```tsx
    <div className={cn(messageBarClassNames.body, 'min-w-0 flex-1 text-body-1')}>
```

to:

```tsx
    <div
      ref={measuring ? setTextElement : undefined}
      className={cn(
        messageBarClassNames.body,
        'min-w-0 flex-1 text-body-1',
        unwrapped && 'whitespace-nowrap',
      )}
    >
```

In the root element, replace `ref={ref}` with `ref={rootRef}`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/feedback/__tests__/MessageBar.reflow.test.tsx src/components/feedback/__tests__/MessageBar.parts.test.tsx src/components/feedback/__tests__/MessageBar.test.tsx --reporter=default`
Expected: PASS, with no act() warning, no hydration error and no `[WaveUI]` line in the output.

- [ ] **Step 6: Quick checks**

```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.dev.json --noEmit
npx eslint src/components/feedback/MessageBar.tsx src/components/feedback/MessageBar.reflow.ts src/components/feedback/__tests__/MessageBar.reflow.test.tsx --max-warnings 0
npx vitest run src/__tests__/conventions.test.ts -t "src/components/feedback/MessageBar"
npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Feedback/MessageBar"
node scripts/build-css.mjs
```

Expected: all pass (the React Compiler rules of `eslint-plugin-react-hooks` accept the store pattern, as they accept Overflow's; `build-css` proves the new comments generate no utility).

- [ ] **Step 7: Commit**

```bash
git add src/components/feedback/MessageBar.reflow.ts src/components/feedback/MessageBar.tsx src/components/feedback/__tests__/MessageBar.reflow.test.tsx
git commit -m "feat(feedback): measure the auto MessageBar layout"
```

---

### Task M5: Stories, package verification and report

**Files:**
- Modify: `stories/MessageBar.stories.tsx`

**Interfaces:**
- Consumes: `MessageBar.Title`, `MessageBar.Actions` (Task M1), `layout` (Task M3). The story imports stay on `'../src'`: `MessageBar` is an existing export and its parts are reached through the compound, so no module-path import is needed (spec §0.2 rule 25 concerns stories of new modules).
- Produces: stories `WithTitle`, `WithActions`, `Multiline`, `Reflow`, `RegionNotice`; a `layout` argType.

- [ ] **Step 1: Add the `layout` argType**

In the `meta` object, replace:

```tsx
  argTypes: {
    status: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error'],
    },
  },
```

with:

```tsx
  argTypes: {
    status: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error'],
    },
    layout: {
      control: 'select',
      options: ['auto', 'singleline', 'multiline'] satisfies readonly NonNullable<
        MessageBarProps['layout']
      >[],
    },
  },
```

- [ ] **Step 2: Add the stories at the end of the file**

```tsx
/**
 * `MessageBar.Title` is read right after the severity: "Warning: Update available A new version is
 * ready to install."
 */
export const WithTitle: Story = {
  args: {
    status: 'warning',
    children: (
      <>
        <MessageBar.Title>Update available</MessageBar.Title>A new version is ready to install.
      </>
    ),
  },
};

/**
 * `MessageBar.Actions` sit after the text while it fits on one line (`layout="auto"`, the default)
 * and move under it otherwise. Tab reaches the links of the text, the actions, then the Dismiss
 * button.
 */
export const WithActions: Story = {
  args: {
    status: 'error',
    onDismiss: fn(),
    children: (
      <>
        <MessageBar.Title>Upload failed</MessageBar.Title>The file is larger than 10 MB.
        <MessageBar.Actions>
          <Button size="small">Retry</Button>
          <Button size="small" appearance="subtle">
            Details
          </Button>
        </MessageBar.Actions>
      </>
    ),
  },
  render: (args) => <DismissibleMessageBar {...args} />,
};

/** `layout="multiline"`: the actions always get a row of their own under the text. */
export const Multiline: Story = {
  args: {
    status: 'success',
    layout: 'multiline',
    children: (
      <>
        <MessageBar.Title>Backup complete</MessageBar.Title>All 1,204 files were copied to the
        archive.
        <MessageBar.Actions>
          <Button size="small">Open archive</Button>
        </MessageBar.Actions>
      </>
    ),
  },
};

/**
 * `layout="auto"` measures after mount: narrow the container (drag its lower corner) and the actions
 * move under the text once it no longer fits on one line; widen it and they come back. The text is
 * never cut off.
 */
export const Reflow: Story = {
  args: {
    status: 'warning',
    children: (
      <>
        <MessageBar.Title>Storage almost full</MessageBar.Title>You have used 9.6 GB of your 10 GB
        plan.
        <MessageBar.Actions>
          <Button size="small">Upgrade</Button>
          <Button size="small" appearance="subtle">
            Manage files
          </Button>
        </MessageBar.Actions>
      </>
    ),
  },
  render: (args) => (
    <div className="w-[720px] min-w-[240px] max-w-full resize-x overflow-hidden p-1">
      <MessageBar {...args} />
    </div>
  ),
};

/**
 * A notice that stays on the page: `role="region"` makes it a landmark named by its severity and
 * title ("Warning: Maintenance tonight"). With the default roles the bar is a live region, and the
 * title is read as the start of its content instead.
 */
export const RegionNotice: Story = {
  args: {
    status: 'warning',
    role: 'region',
    children: (
      <>
        <MessageBar.Title>Maintenance tonight</MessageBar.Title>The service is unavailable from
        22:00 to 23:00 UTC.
      </>
    ),
  },
};
```

- [ ] **Step 3: Run the stories gate**

Run: `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Feedback/MessageBar"`
Expected: PASS for every MessageBar story (jsdom has no ResizeObserver: `Reflow` renders its one-row layout through the fallback of Task M4).

- [ ] **Step 4: Package verification**

```bash
npx vitest run src/components/feedback/__tests__/MessageBar.test.tsx src/components/feedback/__tests__/MessageBar.parts.test.tsx src/components/feedback/__tests__/MessageBar.reflow.test.tsx --reporter=default
npx vitest run src/__tests__/conventions.test.ts -t "MessageBar"
npx vitest run src/__tests__/stories.a11y.test.tsx -t "Components/Feedback/MessageBar"
npx vitest run src/__tests__/classNames.test.ts src/__tests__/public-types.test.ts src/__tests__/integration.test.tsx .storybook/__tests__/exportDocblocks.test.ts
npm run typecheck
npm run lint
npm run format:check
node scripts/build-css.mjs
```

Expected: all pass, with clean output (no act() warning, no unasserted `[WaveUI]` warning). `integration.test.tsx` is only run, not edited: its MessageBar cases use 0.7 APIs and stay green.

- [ ] **Step 5: Commit**

```bash
git add stories/MessageBar.stories.tsx
git commit -m "feat(feedback): MessageBar stories for titles, actions and layouts"
```

- [ ] **Step 6: Package report for the lead (no file change)**

Report, in this order:

1. **Barrel requests for INTEGRATION (Task I1, spec §4.3):** `src/components/feedback/index.ts` adds `MessageBarTitle`, `MessageBarActions` and the types `MessageBarTitleProps`, `MessageBarActionsProps`, all from `./MessageBar`; `PENDING_CLASS_NAMES` drops `messageBarTitleClassNames` and `messageBarActionsClassNames`; `PENDING_PUBLIC_TYPES` drops `MessageBarTitleProps` and `MessageBarActionsProps`; the Server Component regression suite adds both parts (§4.4 #11); `PENDING_FLAT_EXPORTS` drops `'MessageBar'` once the flat names are in the barrel.
2. **0.7 tests changed:** none broke; `MessageBar.test.tsx` gained the `layout (P3-04)` block. The §6.4 pins (`:169`, `:1352`) pass unchanged.
3. **Behaviours asserted only as attributes and classes** (jsdom has no layout, no ResizeObserver and no screen reader), for the lead's real-browser and screen-reader checklist (spec §6.3 item 3): a titled `alert` bar is read once, title included, with the default role (NVDA, JAWS, VoiceOver, TalkBack, Narrator); a `role="region"` bar appears in the landmarks list named "Warning: <title>"; `'auto'` switches to multiline and back as the window narrows and widens, with no jump on load and no "ResizeObserver loop" error in the console; at 320 px width, 400 % zoom and with WCAG 1.4.12 text spacing no text is cut off, also with an explicit `layout="singleline"`; the `Reflow` story in the light, dark and high-contrast themes and in RTL.
4. **Deliberate differences for the spec's §10 implementation notes:** (a) the multiline layout stacks the text column and the actions in a layout wrapper instead of placing the actions in a root grid cell (`row-start-2 col-start-2`): the same DOM order and look, no empty grid track when the icon or the Dismiss button is absent, and the root keeps 0.7's classes in every layout; (b) a `MessageBar.Title` whose children render nothing is left out like empty actions; (c) the reflow measures before paint after every one-row commit, re-measures on text changes inside the column (MutationObserver), falls back to window resizes without ResizeObserver, and measures a ResizeObserver report one animation frame later (avoids the observer loop error); (d) the StrictMode "one `observe` call" of the spec's test list is asserted as one active observer (StrictMode runs effects twice); (e) a title names a bar with any consumer role other than a live-region role or a role that takes no name (the spec names `region` and `group`); (f) several `MessageBar.Actions` parts render side by side in the action area, each its own container (stacked in the multiline layout).
