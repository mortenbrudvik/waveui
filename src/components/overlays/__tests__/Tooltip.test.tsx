import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '../Tooltip';
import { Popover } from '../Popover';
import { Button } from '../../button/Button';
import { Portal } from '../../portal/Portal';
import { useDismiss } from '../../../hooks/useDismiss';
import {
  expectNoA11yViolations,
  renderWithProviders,
  testComposedHandler,
  testSystemProps,
} from '../../../test-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const html = document.documentElement;

/** Layout boxes by `data-testid` and a 1024×768 viewport (jsdom has no layout). */
function mockLayout(boxes: Record<string, Box>) {
  Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
  Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
  const boxOf = (el: Element) => {
    const id = el.getAttribute('data-testid');
    if (id) return boxes[id];
    return el.hasAttribute('data-wave-tooltip-surface') ? boxes.surface : undefined;
  };
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const { x, y, width, height } = boxOf(this) ?? { x: 0, y: 0, width: 0, height: 0 };
    const full = { x, y, left: x, top: y, width, height, right: x + width, bottom: y + height };
    return { ...full, toJSON: () => full } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxOf(this)?.width ?? 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxOf(this)?.height ?? 0;
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(html, 'clientWidth');
  Reflect.deleteProperty(html, 'clientHeight');
});

/** Fake timers that user-event can drive (C-TESTS). */
function setupTimers() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

/**
 * Advances the fake clock inside a synchronous act(): the show/hide timers set Tooltip state.
 * Synchronous on purpose — an async act yields a macrotask, and `shouldAdvanceTime` would then
 * move the clock by real elapsed time, blurring the exact delay boundaries these tests check.
 */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * Advances the fake clock (inside act) to an absolute fake time. user-event's own awaits yield
 * to macrotasks, where `shouldAdvanceTime` moves the clock by real elapsed time; measuring from a
 * timestamp taken when the timer was scheduled keeps delay boundaries exact.
 */
function advanceTo(time: number) {
  const ms = time - Date.now();
  expect(ms, 'user-event already consumed the delay under test').toBeGreaterThanOrEqual(0);
  advance(ms);
}

/** Moves focus directly inside act(): the focus/blur handlers set Tooltip state. */
function focus(el: HTMLElement) {
  act(() => {
    el.focus();
  });
}

/** The children-shape warning of the fallback span (renderTrigger). */
const CHILDREN_WARNING = expect.stringMatching(
  /^\[WaveUI\] Tooltip: expected a single React element child/,
);

/** The warning for a child that does not pass the relationship on to its focusable element. */
const FOCUS_TARGET_WARNING = expect.stringMatching(
  /^\[WaveUI\] Tooltip: the element that takes focus inside it did not get/,
);

/** The portaled visual surface (aria-hidden, so not reachable by role). */
const surface = () => document.querySelector<HTMLElement>('[data-wave-tooltip-surface]');

/** Whether a tooltip is visibly shown (the 0.4 inline role="tooltip" element or the 0.5 surface). */
const isShown = () => surface() !== null || screen.queryByRole('tooltip') !== null;

/** A raw F4 parent layer (useDismiss + Portal) — stand-in for a Dialog around a Tooltip. */
function ParentLayer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const { layerId } = useDismiss({ open, onDismiss: () => setOpen(false), refs: [surfaceRef] });
  if (!open) return null;
  return (
    <Portal layerId={layerId}>
      <div ref={surfaceRef} role="dialog" aria-label="Parent">
        {children}
      </div>
    </Portal>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tooltip', () => {
  // `data-testid`, `className` and `ref` stay on the wrapper span; `aria-*` reach the child.
  testSystemProps(Tooltip, {
    expectedTag: 'span',
    displayName: 'Tooltip',
    defaultProps: { content: 'tip', children: <button type="button">target</button> },
    control: { role: 'button' },
  });

  describe('hidden description (overlays#14, overlays#18)', () => {
    it('does not show the visual surface by default and renders no portal', () => {
      render(
        <Tooltip content="Tooltip text">
          <button type="button">Hover me</button>
        </Tooltip>,
      );
      expect(surface()).toBeNull();
      expect(document.querySelector('[data-wave-portal]')).toBeNull();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('always renders an inline hidden role="tooltip" description', () => {
      const { container } = render(
        <Tooltip content="Tooltip text">
          <button type="button">Hover me</button>
        </Tooltip>,
      );
      const description = screen.getByRole('tooltip', { hidden: true });
      expect(description).toHaveAttribute('hidden');
      expect(description).toHaveTextContent('Tooltip text');
      expect(container.contains(description)).toBe(true);
    });

    it('describes the child immediately, before any delay', () => {
      render(
        <Tooltip content="Saves the draft" delay={5000}>
          <button type="button">Save</button>
        </Tooltip>,
      );
      expect(screen.getByRole('button', { name: 'Save' })).toHaveAccessibleDescription(
        'Saves the draft',
      );
    });

    it('keeps the child’s own aria-describedby while hidden, visible and after unhover', async () => {
      const user = setupTimers();
      render(
        <>
          <span id="own-hint">Ctrl+S</span>
          <Tooltip content="Saves the draft" delay={0}>
            <button type="button" aria-describedby="own-hint">
              Save
            </button>
          </Tooltip>
        </>,
      );
      const button = screen.getByRole('button', { name: 'Save' });
      const tooltipId = screen.getByRole('tooltip', { hidden: true }).id;
      expect(button).toHaveAttribute('aria-describedby', `own-hint ${tooltipId}`);
      expect(button).toHaveAccessibleDescription('Ctrl+S Saves the draft');
      await user.hover(button);
      await waitFor(() => expect(surface()).not.toBeNull());
      expect(button).toHaveAttribute('aria-describedby', `own-hint ${tooltipId}`);
      await user.unhover(button);
      advance(200);
      await waitFor(() => expect(surface()).toBeNull());
      expect(button).toHaveAttribute('aria-describedby', `own-hint ${tooltipId}`);
    });
  });

  describe('delay and timers (overlays#17, overlays#22)', () => {
    it('shows the surface on hover only once the delay has elapsed', async () => {
      const user = setupTimers();
      // The consumer handler runs just before the built-in one schedules the show timer.
      let enteredAt = 0;
      render(
        <Tooltip content="Tooltip text" delay={300} onMouseEnter={() => (enteredAt = Date.now())}>
          <button type="button">Hover me</button>
        </Tooltip>,
      );
      await user.hover(screen.getByRole('button', { name: 'Hover me' }));
      advanceTo(enteredAt + 299);
      expect(surface()).toBeNull();
      advance(1);
      await waitFor(() => expect(surface()).toHaveTextContent('Tooltip text'));
    });

    it('shows on Tab-to after the delay and hides on Tab-away', async () => {
      const user = setupTimers();
      // The consumer handler runs just before the built-in one schedules the show timer.
      let focusedAt = 0;
      render(
        <>
          <Tooltip content="Tooltip text" delay={200} onFocus={() => (focusedAt = Date.now())}>
            <button type="button">Target</button>
          </Tooltip>
          <button type="button">Next</button>
        </>,
      );
      await user.tab();
      expect(screen.getByRole('button', { name: 'Target' })).toHaveFocus();
      advanceTo(focusedAt + 199);
      expect(surface()).toBeNull();
      advance(1);
      await waitFor(() => expect(surface()).not.toBeNull());
      await user.tab();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
      expect(surface()).toBeNull();
    });

    it('enter → focus → leave → blur leaves the tooltip hidden (no orphaned timer)', async () => {
      const user = setupTimers();
      render(
        <>
          <Tooltip content="Tooltip text" delay={200}>
            <button type="button">Target</button>
          </Tooltip>
          <button type="button">Elsewhere</button>
        </>,
      );
      const target = screen.getByRole('button', { name: 'Target' });
      await user.hover(target);
      focus(target);
      await user.unhover(target);
      focus(screen.getByRole('button', { name: 'Elsewhere' }));
      advance(1000);
      expect(isShown()).toBe(false);
    });

    it('cancels a pending show when the pointer leaves before the delay', async () => {
      const user = setupTimers();
      render(
        <Tooltip content="Tooltip text" delay={200}>
          <button type="button">Target</button>
        </Tooltip>,
      );
      const target = screen.getByRole('button', { name: 'Target' });
      await user.hover(target);
      advance(100);
      await user.unhover(target);
      advance(1000);
      expect(isShown()).toBe(false);
    });
  });

  describe('dismissal (overlays#19)', () => {
    it('hides after a short grace period when the pointer leaves', async () => {
      const user = setupTimers();
      render(
        <Tooltip content="Tooltip text" delay={0}>
          <button type="button">Target</button>
        </Tooltip>,
      );
      const target = screen.getByRole('button', { name: 'Target' });
      await user.hover(target);
      await waitFor(() => expect(surface()).not.toBeNull());
      await user.unhover(target);
      expect(surface()).not.toBeNull();
      advance(150);
      await waitFor(() => expect(surface()).toBeNull());
    });

    it('stays visible while the pointer moves onto the tooltip (hoverable)', async () => {
      const user = setupTimers();
      render(
        <Tooltip content="Tooltip text" delay={0}>
          <button type="button">Target</button>
        </Tooltip>,
      );
      const target = screen.getByRole('button', { name: 'Target' });
      await user.hover(target);
      await waitFor(() => expect(surface()).not.toBeNull());
      await user.unhover(target);
      await user.hover(surface()!);
      advance(500);
      expect(surface()).not.toBeNull();
      await user.unhover(surface()!);
      advance(150);
      await waitFor(() => expect(surface()).toBeNull());
    });

    it('has a transparent hover bridge only across the gap facing the trigger', async () => {
      const user = setupTimers();
      render(
        <Tooltip content="Tooltip text" delay={0}>
          <button type="button">Target</button>
        </Tooltip>,
      );
      await user.hover(screen.getByRole('button', { name: 'Target' }));
      await waitFor(() => expect(surface()).not.toBeNull());
      const el = surface()!;
      expect(el).toHaveClass('before:absolute');
      // Above the trigger: a strip below the surface; below it: a strip above; and so on.
      expect(el).toHaveClass(
        'data-[side=top]:before:inset-x-0',
        'data-[side=top]:before:top-full',
        'data-[side=top]:before:h-2',
        'data-[side=bottom]:before:inset-x-0',
        'data-[side=bottom]:before:bottom-full',
        'data-[side=bottom]:before:h-2',
        'data-[side=left]:before:inset-y-0',
        'data-[side=left]:before:left-full',
        'data-[side=left]:before:w-2',
        'data-[side=right]:before:inset-y-0',
        'data-[side=right]:before:right-full',
        'data-[side=right]:before:w-2',
      );
      // No bridge on the sides away from the trigger (it would catch neighbouring controls).
      expect(el.className).not.toMatch(/(^|\s)before:-?inset-/);
    });

    it('Escape hides a visible tooltip', async () => {
      const user = setupTimers();
      render(
        <Tooltip content="Tooltip text" delay={0}>
          <button type="button">Target</button>
        </Tooltip>,
      );
      await user.tab();
      await waitFor(() => expect(surface()).not.toBeNull());
      await user.keyboard('{Escape}');
      expect(surface()).toBeNull();
      expect(screen.getByRole('button', { name: 'Target' })).toHaveFocus();
    });

    it('Escape closes only the tooltip, not the enclosing layer (overlays#1)', async () => {
      const user = setupTimers();
      render(
        <ParentLayer>
          <Tooltip content="Tooltip text" delay={0}>
            <button type="button">Target</button>
          </Tooltip>
        </ParentLayer>,
      );
      focus(screen.getByRole('button', { name: 'Target' }));
      await waitFor(() => expect(surface()).not.toBeNull());
      await user.keyboard('{Escape}');
      expect(surface()).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Parent' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Parent' })).not.toBeInTheDocument();
    });
  });

  describe('visual surface (overlays#36, overlays#37, overlays#38)', () => {
    it('renders the surface in a tooltip-layer portal, hidden from assistive technology', async () => {
      const user = setupTimers();
      const { container } = render(
        <Tooltip content="Tooltip text" delay={0}>
          <button type="button">Target</button>
        </Tooltip>,
      );
      await user.hover(screen.getByRole('button', { name: 'Target' }));
      await waitFor(() => expect(surface()).not.toBeNull());
      const el = surface()!;
      expect(el).toHaveAttribute('aria-hidden', 'true');
      expect(container.contains(el)).toBe(false);
      expect(el.closest('[data-wave-portal]')).toHaveAttribute('data-layer', 'tooltip');
    });

    it('wraps text and resets inherited typography', async () => {
      const user = setupTimers();
      render(
        <Tooltip content="Tooltip text" delay={0}>
          <button type="button">Target</button>
        </Tooltip>,
      );
      await user.hover(screen.getByRole('button', { name: 'Target' }));
      await waitFor(() => expect(surface()).not.toBeNull());
      expect(surface()).toHaveClass(
        'max-w-60',
        'whitespace-normal',
        'normal-case',
        'tracking-normal',
        'font-normal',
        'text-start',
        'text-caption-1',
      );
    });

    it('opens on top, centred, by default and exposes the placement', async () => {
      mockLayout({
        target: { x: 400, y: 300, width: 80, height: 32 },
        surface: { x: 0, y: 0, width: 120, height: 28 },
      });
      const user = setupTimers();
      render(
        <Tooltip content="Tooltip text" delay={0} data-testid="target">
          <button type="button">Target</button>
        </Tooltip>,
      );
      await user.hover(screen.getByRole('button', { name: 'Target' }));
      // data-side/data-align start as the requested placement: wait for the computed position,
      // centred above the wrapper 8px away.
      // x = 400 + 80 / 2 - 120 / 2 = 380, y = 300 - 28 - 8 = 264.
      await waitFor(() => expect(surface()?.style.transform).toBe('translate(380px, 264px)'));
      expect(surface()).toHaveAttribute('data-side', 'top');
      expect(surface()).toHaveAttribute('data-align', 'center');
    });

    it('flips below the trigger when the top collides with the viewport', async () => {
      mockLayout({
        target: { x: 400, y: 2, width: 80, height: 32 },
        surface: { x: 0, y: 0, width: 120, height: 28 },
      });
      const user = setupTimers();
      render(
        <Tooltip content="Tooltip text" delay={0} data-testid="target">
          <button type="button">Target</button>
        </Tooltip>,
      );
      await user.hover(screen.getByRole('button', { name: 'Target' }));
      await waitFor(() => expect(surface()).toHaveAttribute('data-side', 'bottom'));
    });

    it('resolves side="end" to the left in RTL (feedback-navigation#34)', async () => {
      mockLayout({
        target: { x: 400, y: 300, width: 80, height: 32 },
        surface: { x: 0, y: 0, width: 120, height: 28 },
      });
      const user = setupTimers();
      renderWithProviders(
        <Tooltip content="Tooltip text" delay={0} side="end" data-testid="target">
          <button type="button">Target</button>
        </Tooltip>,
        { dir: 'rtl' },
      );
      await user.hover(screen.getByRole('button', { name: 'Target' }));
      await waitFor(() => expect(surface()).toHaveAttribute('data-side', 'left'));
      expect(surface()!.closest('[data-wave-portal]')).toHaveAttribute('dir', 'rtl');
    });
  });

  describe('appearance (layout#16, button-provider#3)', () => {
    async function showSurface(ui: React.ReactElement) {
      const user = setupTimers();
      render(ui);
      await user.hover(screen.getByRole('button', { name: 'Target' }));
      await waitFor(() => expect(surface()).not.toBeNull());
      return surface()!;
    }

    it('uses the inverted token colors by default', async () => {
      const el = await showSurface(
        <Tooltip content="Tip" delay={0}>
          <button type="button">Target</button>
        </Tooltip>,
      );
      expect(el).toHaveClass('bg-inverted', 'text-inverted-foreground', 'border-inverted-border');
    });

    it('appearance="normal" uses the background token colors', async () => {
      const el = await showSurface(
        <Tooltip content="Tip" appearance="normal" delay={0}>
          <button type="button">Target</button>
        </Tooltip>,
      );
      expect(el).toHaveClass('bg-background', 'text-foreground', 'border-border');
      expect(el).not.toHaveClass('bg-inverted');
    });

    it.each([
      ['light', 'bg-background'],
      ['dark', 'bg-inverted'],
    ] as const)(
      'the deprecated variant="%s" still works and warns once',
      async (variant, expected) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const el = await showSurface(
          <Tooltip content="Tip" variant={variant} delay={0}>
            <button type="button">Target</button>
          </Tooltip>,
        );
        expect(el).toHaveClass(expected);
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] Tooltip: `variant` is deprecated and will be removed in 1.0. Use `appearance` instead.',
          ],
        ]);
      },
    );

    it('appearance wins over the deprecated variant', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const el = await showSurface(
        <Tooltip content="Tip" appearance="inverted" variant="light" delay={0}>
          <button type="button">Target</button>
        </Tooltip>,
      );
      expect(el).toHaveClass('bg-inverted');
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Tooltip: `variant` is deprecated and will be removed in 1.0. Use `appearance` instead.',
        ],
      ]);
    });
  });

  describe('relationship (overlays#20)', () => {
    it('relationship="label" names an icon-only button', () => {
      render(
        <Tooltip content="Save" relationship="label">
          <button type="button">
            <svg aria-hidden="true" viewBox="0 0 16 16" />
          </button>
        </Tooltip>,
      );
      const button = screen.getByRole('button', { name: 'Save' });
      expect(button).not.toHaveAttribute('aria-describedby');
    });

    it('relationship="label" names an icon-only Button without its missing-name warning', () => {
      const warn = vi.spyOn(console, 'warn');
      render(
        <Tooltip content="Save" relationship="label">
          <Button icon={<svg viewBox="0 0 16 16" />} />
        </Tooltip>,
      );
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });

    it('relationship="label" merges with the child’s own aria-labelledby', () => {
      render(
        <>
          <span id="prefix">Document</span>
          <Tooltip content="Save" relationship="label">
            <button type="button" aria-labelledby="prefix" />
          </Tooltip>
        </>,
      );
      expect(screen.getByRole('button', { name: 'Document Save' })).toBeInTheDocument();
    });
  });

  describe('children fallback (overlays#21)', () => {
    it.each([
      ['text', 'Plain text' as unknown as React.ReactElement],
      [
        'a Fragment',
        <>
          <span>Frag</span>
          <span>ment</span>
        </>,
      ],
    ])('renders %s inside a described span and warns', (_, children) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { container } = render(<Tooltip content="Help">{children}</Tooltip>);
      const described = container.querySelector('[aria-describedby]');
      expect(described?.tagName).toBe('SPAN');
      expect(described).toHaveAccessibleDescription('Help');
      expect(warn.mock.calls).toEqual([[CHILDREN_WARNING]]);
    });

    it('renders several element children inside a described span', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const children = [<span key="a">A</span>, <span key="b">B</span>];
      const { container } = render(
        <Tooltip content="Help">{children as unknown as React.ReactElement}</Tooltip>,
      );
      expect(container.querySelector('[aria-describedby]')).toHaveTextContent('AB');
      expect(warn.mock.calls).toEqual([[CHILDREN_WARNING]]);
    });

    it('describes the element of a single-element Fragment, without a wrapper or a warning', () => {
      const warn = vi.spyOn(console, 'warn');
      const { container } = render(
        <Tooltip content="Explains">
          <>
            <Button>Help</Button>
          </>
        </Tooltip>,
      );
      const button = screen.getByRole('button', { name: 'Help' });
      expect(button).toHaveAccessibleDescription('Explains');
      // The Button is the Tooltip wrapper's own child: no fallback span in between.
      expect(button.parentElement).toBe(container.firstElementChild);
      expect(warn).not.toHaveBeenCalled();
    });

    it('describes the first focusable element among children rendered in the fallback span', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tooltip content="Explains">
          <>
            <span>Need a hand?</span>
            <Button>Help</Button>
            <Button>More</Button>
          </>
        </Tooltip>,
      );
      expect(screen.getByRole('button', { name: 'Help' })).toHaveAccessibleDescription('Explains');
      expect(screen.getByRole('button', { name: 'More' })).not.toHaveAttribute('aria-describedby');
      // Only the children-shape warning: the fallback itself is expected.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('single React element child'));
    });

    it('names the first focusable element in the fallback span with relationship="label"', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tooltip content="Save" relationship="label">
          <>
            <button type="button">
              <svg aria-hidden="true" viewBox="0 0 16 16" />
            </button>
            <span>draft</span>
          </>
        </Tooltip>,
      );
      expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-describedby');
      // Only the children-shape warning: the fallback itself is expected.
      expect(warn.mock.calls).toEqual([[CHILDREN_WARNING]]);
    });
  });

  describe('a child that does not pass the relationship on (overlays#5)', () => {
    /** Renders its children but drops every other prop (like a Popover or Dialog root). */
    function DropsProps({ children }: { children?: React.ReactNode }) {
      return <div>{children}</div>;
    }

    it('describes the focusable element inside a Popover root and warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tooltip content="Narrow the list">
          <Popover>
            <Popover.Trigger>
              <Button>Filters</Button>
            </Popover.Trigger>
            <Popover.Content>Body</Popover.Content>
          </Popover>
        </Tooltip>,
      );
      expect(screen.getByRole('button', { name: 'Filters' })).toHaveAccessibleDescription(
        'Narrow the list',
      );
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[WaveUI\] Tooltip: .*Trigger/));
    });

    it('describes the focusable element inside a non-focusable child element and warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tooltip content="Formatting">
          <div>
            <Button>Bold</Button>
          </div>
        </Tooltip>,
      );
      expect(screen.getByRole('button', { name: 'Bold' })).toHaveAccessibleDescription(
        'Formatting',
      );
      expect(warn.mock.calls).toEqual([[FOCUS_TARGET_WARNING]]);
    });

    it('keeps the focusable element’s own description ids', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <span id="own-hint">Ctrl+S</span>
          <Tooltip content="Saves the draft">
            <DropsProps>
              <button type="button" aria-describedby="own-hint">
                Save
              </button>
            </DropsProps>
          </Tooltip>
        </>,
      );
      expect(screen.getByRole('button', { name: 'Save' })).toHaveAccessibleDescription(
        'Ctrl+S Saves the draft',
      );
      expect(warn.mock.calls).toEqual([[FOCUS_TARGET_WARNING]]);
    });

    it('describes a focusable element the child replaces without re-rendering the Tooltip', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      function Swap() {
        const [count, setCount] = React.useState(0);
        return (
          <button key={count} type="button" onClick={() => setCount((c) => c + 1)}>
            {`Swap ${count}`}
          </button>
        );
      }
      render(
        <Tooltip content="Replaces the button">
          <DropsProps>
            <Swap />
          </DropsProps>
        </Tooltip>,
      );
      expect(screen.getByRole('button', { name: 'Swap 0' })).toHaveAccessibleDescription(
        'Replaces the button',
      );
      await user.click(screen.getByRole('button', { name: 'Swap 0' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Swap 1' })).toHaveAccessibleDescription(
          'Replaces the button',
        ),
      );
      // Once per page, not again for the replacement.
      expect(warn.mock.calls).toEqual([[FOCUS_TARGET_WARNING]]);
    });

    it('does not warn for a child without focusable content (text, a disabled button)', () => {
      const warn = vi.spyOn(console, 'warn');
      render(
        <>
          <Tooltip content="Full name">
            <span>Ada L.</span>
          </Tooltip>
          <Tooltip content="Unavailable">
            <Button disabled>Delete</Button>
          </Tooltip>
        </>,
      );
      expect(screen.getByText('Ada L.')).toHaveAccessibleDescription('Full name');
      expect(screen.getByRole('button', { name: 'Delete' })).toHaveAccessibleDescription(
        'Unavailable',
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('inside a trigger: props for the child (overlays#5)', () => {
    /**
     * Stand-in for a trigger that clones its child (Menu.Trigger, Dialog.Trigger): it merges an
     * `id`, state ARIA, a click handler and a ref onto the Tooltip.
     */
    function TriggerStandIn({ children }: { children: React.ReactElement }) {
      const [open, setOpen] = React.useState(false);
      const ref = React.useRef<HTMLElement | null>(null);
      return (
        <>
          {React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id: 'menu-trigger',
            'aria-haspopup': 'menu',
            'aria-expanded': open,
            'aria-controls': open ? 'menu-list' : undefined,
            onClick: () => setOpen((o) => !o),
            ref,
          })}
          {open && (
            <ul id="menu-list" role="menu" aria-labelledby="menu-trigger">
              <li role="menuitem" tabIndex={-1}>
                Edit
              </li>
            </ul>
          )}
        </>
      );
    }

    it('puts the id and ARIA it receives on its child, not on the wrapper span', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <TriggerStandIn>
          <Tooltip content="More actions" delay={0}>
            <Button>Actions</Button>
          </Tooltip>
        </TriggerStandIn>,
      );
      const wrapper = container.firstElementChild as HTMLElement;
      const button = screen.getByRole('button', { name: 'Actions' });
      expect(button).toHaveAttribute('id', 'menu-trigger');
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAccessibleDescription('More actions');
      for (const attr of ['id', 'aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(wrapper).not.toHaveAttribute(attr);
      }
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', 'menu-list');
      expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
      await expectNoA11yViolations();
    });

    it('merges them with the child’s own: its id wins, id lists join, state ARIA wins', () => {
      render(
        <>
          <span id="outer-hint">Outer</span>
          <span id="own-hint">Own</span>
          <Tooltip
            content="Tip"
            id="from-parent"
            aria-describedby="outer-hint"
            aria-expanded={false}
            data-testid="wrapper"
            className="wrapper-class"
          >
            <button
              type="button"
              id="own-id"
              aria-describedby="own-hint"
              aria-expanded="true"
              className="child-class"
            >
              Target
            </button>
          </Tooltip>
        </>,
      );
      const button = screen.getByRole('button', { name: 'Target' });
      const wrapper = screen.getByTestId('wrapper');
      expect(button).toHaveAttribute('id', 'own-id');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAccessibleDescription('Own Outer Tip');
      expect(button).toHaveClass('child-class');
      expect(button).not.toHaveClass('wrapper-class');
      expect(wrapper).toHaveClass('wrapper-class');
      expect(wrapper).not.toHaveAttribute('id');
      expect(wrapper).not.toHaveAttribute('aria-describedby');
      expect(wrapper).not.toHaveAttribute('aria-expanded');
    });

    it('nested Tooltips describe the same element with both texts', () => {
      render(
        <Tooltip content="Outer tip">
          <Tooltip content="Inner tip">
            <button type="button">Target</button>
          </Tooltip>
        </Tooltip>,
      );
      expect(screen.getByRole('button', { name: 'Target' })).toHaveAccessibleDescription(
        'Outer tip Inner tip',
      );
    });

    it('keeps state ARIA from a parent off the fallback span', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { container } = render(
        <Tooltip content="Tip" aria-haspopup="menu" aria-expanded={false}>
          <>
            <button type="button">A</button>
            <button type="button">B</button>
          </>
        </Tooltip>,
      );
      expect(container.querySelector('[aria-expanded]')).toBeNull();
      expect(container.querySelector('[aria-haspopup]')).toBeNull();
      expect(warn.mock.calls).toEqual([[CHILDREN_WARNING]]);
    });

    it('a click on the portaled tooltip surface does not reach the handlers it was given', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Tooltip content="Tip" delay={0} onClick={onClick}>
          <button type="button">Target</button>
        </Tooltip>,
      );
      const target = screen.getByRole('button', { name: 'Target' });
      await user.hover(target);
      await waitFor(() => expect(surface()).not.toBeNull());
      await user.click(surface() as HTMLElement);
      expect(onClick).not.toHaveBeenCalled();
      await user.click(target);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('a child that renders a popup in a portal', () => {
    /** Stand-in for a DatePicker: an input and a calendar it portals while open (Enter opens it). */
    function PickerStandIn(props: React.InputHTMLAttributes<HTMLInputElement>) {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <input
            aria-label="Start"
            {...props}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setOpen(true);
            }}
          />
          {open && (
            <Portal>
              <div role="dialog" aria-label="Calendar">
                <button type="button">Day 1</button>
                <button type="button">Day 2</button>
              </div>
            </Portal>
          )}
        </>
      );
    }

    function renderPicker(handlers: Partial<React.ComponentProps<typeof Tooltip>> = {}) {
      render(
        <>
          <Tooltip content="Pick the start date" delay={0} {...handlers}>
            <PickerStandIn />
          </Tooltip>
          <button type="button">Elsewhere</button>
        </>,
      );
      return screen.getByRole('textbox', { name: 'Start' });
    }

    it('focus inside the portaled popup neither shows the tooltip nor reaches onFocus/onBlur', async () => {
      const user = setupTimers();
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      const input = renderPicker({ onFocus, onBlur, delay: 100 });
      await user.tab();
      expect(input).toHaveFocus();
      advance(100);
      await waitFor(() => expect(surface()).not.toBeNull());
      await user.keyboard('{Enter}');
      focus(screen.getByRole('button', { name: 'Day 1' }));
      advance(500);
      expect(surface()).toBeNull();
      // Moving inside the calendar (an arrow key in a date grid).
      focus(screen.getByRole('button', { name: 'Day 2' }));
      advance(500);
      expect(surface()).toBeNull();
      // Focus leaving the calendar for the page is not the child's blur either.
      focus(screen.getByRole('button', { name: 'Elsewhere' }));
      advance(500);
      expect(surface()).toBeNull();
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onFocus.mock.calls[0]?.[0].target).toBe(input);
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(onBlur.mock.calls[0]?.[0].target).toBe(input);
    });

    it('the pointer on the portaled popup hides the tooltip and does not show it again', async () => {
      const user = userEvent.setup();
      const input = renderPicker();
      focus(input);
      await user.keyboard('{Enter}');
      act(() => input.blur());
      await user.hover(input);
      await waitFor(() => expect(surface()).not.toBeNull());
      // From the input onto the calendar: no mouseleave reaches the wrapper (React's tree).
      await user.hover(screen.getByRole('button', { name: 'Day 1' }));
      expect(surface()).toBeNull();
      // From the page onto the calendar: a mouseenter reaches the wrapper through the portal.
      await user.hover(screen.getByRole('button', { name: 'Elsewhere' }));
      await user.hover(screen.getByRole('button', { name: 'Day 1' }));
      expect(surface()).toBeNull();
    });

    it('the pointer on the tooltip surface itself keeps it shown (the hoverable surface)', async () => {
      const user = userEvent.setup();
      const input = renderPicker();
      await user.hover(input);
      await waitFor(() => expect(surface()).not.toBeNull());
      await user.hover(surface()!);
      expect(surface()).not.toBeNull();
    });
  });

  describe('composed handlers (layout#10)', () => {
    testComposedHandler(Tooltip, {
      handler: 'onFocus',
      defaultProps: {
        content: 'Tip',
        delay: 0,
        children: <button type="button">Target</button>,
      },
      act: async ({ user }) => {
        await user.tab();
      },
      assertInternal: async () => {
        await waitFor(() => expect(surface()).not.toBeNull());
      },
      assertInternalSuppressed: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(surface()).toBeNull();
      },
    });

    testComposedHandler(Tooltip, {
      handler: 'onMouseEnter',
      defaultProps: {
        content: 'Tip',
        delay: 0,
        children: <button type="button">Target</button>,
      },
      act: async ({ user }) => {
        await user.hover(screen.getByRole('button', { name: 'Target' }));
      },
      assertInternal: async () => {
        await waitFor(() => expect(surface()).not.toBeNull());
      },
    });
  });

  it('has no accessibility violations while visible (table-core#20)', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Saves the draft" delay={0}>
        <button type="button">Save</button>
      </Tooltip>,
    );
    await user.hover(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(surface()).not.toBeNull());
    await expectNoA11yViolations();
  });
});
