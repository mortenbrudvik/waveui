import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '../Tooltip';
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
  testSystemProps(Tooltip, {
    expectedTag: 'span',
    displayName: 'Tooltip',
    defaultProps: { content: 'tip', children: <span>target</span> },
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
      vi.advanceTimersByTime(200);
      await waitFor(() => expect(surface()).toBeNull());
      expect(button).toHaveAttribute('aria-describedby', `own-hint ${tooltipId}`);
    });
  });

  describe('delay and timers (overlays#17, overlays#22)', () => {
    it('shows the surface on hover only once the delay has elapsed', async () => {
      const user = setupTimers();
      render(
        <Tooltip content="Tooltip text" delay={300}>
          <button type="button">Hover me</button>
        </Tooltip>,
      );
      await user.hover(screen.getByRole('button', { name: 'Hover me' }));
      vi.advanceTimersByTime(299);
      expect(surface()).toBeNull();
      vi.advanceTimersByTime(1);
      await waitFor(() => expect(surface()).toHaveTextContent('Tooltip text'));
    });

    it('shows on Tab-to after the delay and hides on Tab-away', async () => {
      const user = setupTimers();
      render(
        <>
          <Tooltip content="Tooltip text" delay={200}>
            <button type="button">Target</button>
          </Tooltip>
          <button type="button">Next</button>
        </>,
      );
      await user.tab();
      expect(screen.getByRole('button', { name: 'Target' })).toHaveFocus();
      vi.advanceTimersByTime(199);
      expect(surface()).toBeNull();
      vi.advanceTimersByTime(1);
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
      target.focus();
      await user.unhover(target);
      screen.getByRole('button', { name: 'Elsewhere' }).focus();
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
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
      vi.advanceTimersByTime(100);
      await user.unhover(target);
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
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
      vi.advanceTimersByTime(150);
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
      vi.advanceTimersByTime(500);
      await Promise.resolve();
      expect(surface()).not.toBeNull();
      await user.unhover(surface()!);
      vi.advanceTimersByTime(150);
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
      screen.getByRole('button', { name: 'Target' }).focus();
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
      await waitFor(() => expect(surface()).toHaveAttribute('data-side', 'top'));
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
        const messages = warn.mock.calls.map((call) => String(call[0]));
        expect(messages.filter((m) => m.includes('`variant` is deprecated'))).toEqual([
          '[WaveUI] Tooltip: `variant` is deprecated and will be removed in 1.0. Use `appearance` instead.',
        ]);
      },
    );

    it('appearance wins over the deprecated variant', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const el = await showSurface(
        <Tooltip content="Tip" appearance="inverted" variant="light" delay={0}>
          <button type="button">Target</button>
        </Tooltip>,
      );
      expect(el).toHaveClass('bg-inverted');
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
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Tooltip'));
    });

    it('renders several element children inside a described span', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const children = [<span key="a">A</span>, <span key="b">B</span>];
      const { container } = render(
        <Tooltip content="Help">{children as unknown as React.ReactElement}</Tooltip>,
      );
      expect(container.querySelector('[aria-describedby]')).toHaveTextContent('AB');
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
