import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip, type TooltipProps } from '../Tooltip';
import { tooltipClassNames } from '../../../lib/classNames';
import { getOpenLayers } from '../../../lib/layers';
import { tooltipMotion } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-TIP (spec §6.4, D7, D9, D22): the Tooltip's portaled surface mounts through the presence
 * core with a fade of its own (`tooltipMotion`), takes a `motion` slot, renders `data-state` and is
 * `inert` while it exits, still `aria-hidden`; the inline hidden `role="tooltip"` description stays
 * the accessible copy, unchanged in every phase. jsdom loads no CSS, so the phases wait only where
 * `mockAnimations` gives the surface a running animation.
 */

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});

const TEXT = 'Save the file';

const target = () => screen.getByRole('button', { name: 'Save' });
/** The portaled surface, exiting ones included (it is `aria-hidden`, so not reachable by role). */
const surface = () => document.querySelector<HTMLElement>('[data-wave-tooltip-surface]');
/** The presence element of every tooltip: its surface. */
const isSurface = (el: Element) => el.hasAttribute('data-wave-tooltip-surface');
/** The inline hidden description, the copy assistive technology reads. */
const description = () => screen.getByRole('tooltip', { hidden: true });

/** No word of `recipe` on `el`. */
function expectNoWordOf(el: Element | null, recipe: string) {
  expect(el).not.toBeNull();
  for (const word of motionClasses(recipe)) expect(el, word).not.toHaveClass(word);
}

/** The hidden description holds the text and describes the button. */
function expectDescription() {
  const el = description();
  expect(el).toHaveTextContent(TEXT);
  expect(el).toHaveAttribute('hidden');
  expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
  expect(target()).toHaveAttribute('aria-describedby', el.id);
  expect(target()).toHaveAccessibleDescription(TEXT);
}

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/** Fake timers that user-event can drive (C-TESTS). */
function setupTimers() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

/** Advances the fake clock inside act(): the show and hide timers set Tooltip state. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** A Save button with its tooltip (200 ms to show, 100 ms to hide by default). */
function SaveTooltip(props: Partial<TooltipProps>) {
  return (
    <Tooltip content={TEXT} {...props}>
      <button type="button">Save</button>
    </Tooltip>
  );
}

describe('Tooltip motion slot (D5, D6)', () => {
  const open = (slot?: MotionSlot | null): React.ReactElement => (
    <SaveTooltip defaultOpen {...(slot === undefined ? {} : { motion: slot })} />
  );

  it('undefined: the default fade', () => {
    render(open());
    expect(surface()).toHaveClass(tooltipClassNames.content, ...motionClasses(tooltipMotion));
  });

  it('null: no motion, and the surface still renders its phase', () => {
    render(open(null));
    expectNoWordOf(surface(), tooltipMotion);
    expect(surface()).toHaveAttribute('data-presence', 'entered');
  });

  it.each([
    ['a string', 'my-motion'],
    ['a slot object', { className: 'my-motion' }],
  ] as const)('%s replaces the default motion', (_, slot) => {
    render(open(slot));
    expect(surface()).toHaveClass('my-motion');
    expectNoWordOf(surface(), tooltipMotion);
  });

  it('WaveProvider motion="none" turns the default off; the part’s own value still applies', () => {
    const { unmount } = renderWithProviders(open(), { motion: 'none' });
    expectNoWordOf(surface(), tooltipMotion);
    expect(surface()).toHaveAttribute('data-presence', 'entered');
    unmount();
    renderWithProviders(open('my-motion'), { motion: 'none' });
    expect(surface()).toHaveClass('my-motion');
  });

  it('keeps the motion prop off the DOM; the className stays on the wrapper span', () => {
    render(<SaveTooltip defaultOpen motion="my-motion" className="p-8" data-testid="wrapper" />);
    const wrapper = screen.getByTestId('wrapper');
    expect(wrapper).not.toHaveAttribute('motion');
    expect(wrapper).toHaveClass(tooltipClassNames.root, 'p-8');
    expect(wrapper).not.toHaveClass('my-motion');
    expect(surface()).toHaveClass('my-motion');
    expect(surface()).not.toHaveClass('p-8');
  });
});

describe('Tooltip surface presence (D7, D9, D22)', () => {
  it('exits on unhover: kept mounted, closed, inert and still aria-hidden, with the Escape layer released at once', async () => {
    const user = setupTimers();
    const motion = mockAnimations({ animated: isSurface });
    render(<SaveTooltip />);
    await user.hover(target());
    advance(300);
    const el = surface()!;
    expect(el).toHaveAttribute('data-presence', 'entering');
    expect(el).toHaveAttribute('data-state', 'open');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(getOpenLayers()).toHaveLength(1);
    await finish(motion);
    expect(el).toHaveAttribute('data-presence', 'entered');

    await user.unhover(target());
    advance(200);
    expect(surface()).toBe(el);
    expect(el).toHaveAttribute('data-presence', 'exiting');
    expect(el).toHaveAttribute('data-state', 'closed');
    expect(el.closest('[inert]')).toBe(el);
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(getOpenLayers()).toHaveLength(0);

    await finish(motion);
    expect(surface()).toBeNull();
  });

  it('hovered again during its exit: the same surface enters again, open and not inert, with its Escape layer', async () => {
    const user = setupTimers();
    const motion = mockAnimations({ animated: isSurface });
    render(<SaveTooltip />);
    await user.hover(target());
    advance(300);
    await finish(motion);
    const el = surface()!;

    await user.unhover(target());
    advance(200);
    expect(el).toHaveAttribute('data-presence', 'exiting');
    expect(el.closest('[inert]')).toBe(el);

    await user.hover(target());
    advance(300);
    expect(surface()).toBe(el);
    expect(document.querySelectorAll('[data-wave-tooltip-surface]')).toHaveLength(1);
    expect(el).toHaveAttribute('data-presence', 'entering');
    expect(el).toHaveAttribute('data-state', 'open');
    expect(el.closest('[inert]')).toBeNull();
    expect(getOpenLayers()).toHaveLength(1);

    await finish(motion);
    expect(el).toHaveAttribute('data-presence', 'entered');
    // Escape hides it at once: the layer goes on close, the surface after its exit.
    await user.keyboard('{Escape}');
    expect(el).toHaveAttribute('data-presence', 'exiting');
    expect(getOpenLayers()).toHaveLength(0);
    await finish(motion);
    expect(surface()).toBeNull();
  });

  it('the hidden role="tooltip" description is the same in every phase', async () => {
    const user = setupTimers();
    const motion = mockAnimations({ animated: isSurface });
    render(<SaveTooltip />);
    expectDescription();
    const copy = description();

    await user.hover(target());
    advance(300);
    expect(surface()).toHaveAttribute('data-presence', 'entering');
    expectDescription();
    await finish(motion);
    expect(surface()).toHaveAttribute('data-presence', 'entered');
    expectDescription();

    await user.unhover(target());
    advance(200);
    expect(surface()).toHaveAttribute('data-presence', 'exiting');
    expectDescription();
    await finish(motion);
    expect(surface()).toBeNull();
    expectDescription();
    expect(description()).toBe(copy);
  });

  it('renders the hidden description and no surface on the server, open or not', () => {
    for (const element of [
      <SaveTooltip key="closed" />,
      <SaveTooltip key="default" defaultOpen />,
      <SaveTooltip key="controlled" open />,
    ]) {
      const html = renderToString(element);
      expect(html).toContain('role="tooltip"');
      expect(html).toContain(TEXT);
      expect(html).not.toContain('data-wave-tooltip-surface');
      expect(html).not.toContain('data-presence');
    }
  });

  it('animates in a tooltip open by default on a client render (appear)', async () => {
    const motion = mockAnimations({ animated: isSurface });
    render(<SaveTooltip defaultOpen />);
    const el = surface()!;
    expect(el).toHaveAttribute('data-presence', 'entering');
    expect(el).toHaveAttribute('data-state', 'open');
    expect(el).not.toHaveAttribute('inert');
    await finish(motion);
    expect(el).toHaveAttribute('data-presence', 'entered');
  });

  it('follows a controlled open: closed while it exits, then gone', async () => {
    const motion = mockAnimations({ animated: isSurface });
    const { rerender } = render(<SaveTooltip open />);
    await finish(motion);
    const el = surface()!;
    expect(el).toHaveAttribute('data-state', 'open');

    rerender(<SaveTooltip open={false} />);
    expect(surface()).toBe(el);
    expect(el).toHaveAttribute('data-presence', 'exiting');
    expect(el).toHaveAttribute('data-state', 'closed');
    expect(el.closest('[inert]')).toBe(el);
    expect(getOpenLayers()).toHaveLength(0);
    await finish(motion);
    expect(surface()).toBeNull();
  });

  it('under reduced motion enters and exits at once', async () => {
    const user = setupTimers();
    mockAnimations({ animated: isSurface });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    render(<SaveTooltip />);
    await user.hover(target());
    advance(300);
    expect(surface()).toHaveAttribute('data-presence', 'entered');
    await user.unhover(target());
    advance(200);
    expect(surface()).toBeNull();
    expectDescription();
  });

  it('without reduced motion the phases wait for the surface’s motion', async () => {
    const user = setupTimers();
    const motion = mockAnimations({ animated: isSurface });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    render(<SaveTooltip />);
    await user.hover(target());
    advance(300);
    expect(surface()).toHaveAttribute('data-presence', 'entering');
    await finish(motion);
    await user.unhover(target());
    advance(200);
    expect(surface()).toHaveAttribute('data-presence', 'exiting');
    await finish(motion);
    expect(surface()).toBeNull();
  });

  it('under StrictMode calls onOpenChange once per change', async () => {
    const user = setupTimers();
    const motion = mockAnimations({ animated: isSurface });
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <SaveTooltip onOpenChange={onOpenChange} />
      </React.StrictMode>,
    );
    await user.hover(target());
    advance(300);
    await finish(motion);
    await user.unhover(target());
    advance(200);
    expect(surface()).toHaveAttribute('data-presence', 'exiting');
    await finish(motion);
    expect(surface()).toBeNull();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });
});
