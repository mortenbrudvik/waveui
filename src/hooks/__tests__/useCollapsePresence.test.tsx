import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCollapsePresence } from '../useCollapsePresence';
import { cn } from '../../lib/cn';
import { collapseMotion, collapseStructure } from '../../lib/motion';
import type { MotionSlot } from '../../lib/types';
import {
  honourInert,
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
} from '../../test-utils';

/*
 * useCollapsePresence (spec §2.5, D12): the shared collapse of Accordion, Tree and Nav. The
 * wrapper around a disclosure's part mounts through the presence core without `appear` (in-flow
 * content never animates on mount, D9), carries the collapse structure and the resolved motion,
 * and focus inside the part when it closes moves to the disclosure's trigger in the closing
 * commit. jsdom loads no CSS, so the phases wait only where `mockAnimations` gives the wrapper a
 * running animation.
 */

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn');
  error = vi.spyOn(console, 'error');
});
afterEach(() => {
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

interface DisclosureProps {
  open: boolean;
  motion?: MotionSlot | null;
  /** Focuses the input inside the part when it mounts. */
  autoFocus?: boolean;
}

/** A disclosure on the hook: a trigger, and the part (with an input) in the collapse wrapper. */
function Disclosure({ open, motion, autoFocus = false }: DisclosureProps) {
  const partRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const { isMounted, phase, wrapperRef, presenceProps, className } = useCollapsePresence(open, {
    motion,
    partRef,
    getTrigger: () => triggerRef.current,
  });
  return (
    <>
      <button type="button" ref={triggerRef}>
        Toggle
      </button>
      <button type="button">Elsewhere</button>
      {isMounted ? (
        <div
          ref={wrapperRef}
          {...presenceProps}
          data-testid="wrapper"
          data-phase={phase}
          className={cn('test-stable', className)}
        >
          <div ref={partRef} data-testid="part">
            <input aria-label="Inside" autoFocus={autoFocus} />
          </div>
        </div>
      ) : null}
    </>
  );
}

const wrapper = () => screen.queryByTestId('wrapper');
const input = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Inside' });
const button = (name: string) => screen.getByRole('button', { name });
/** The presence element of the disclosure: its collapse wrapper. */
const isWrapper = (el: Element) => el.getAttribute('data-testid') === 'wrapper';

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/** No word of `recipe` on `el`. */
function expectNoWordOf(el: Element | null, recipe: string) {
  expect(el).not.toBeNull();
  for (const word of motionClasses(recipe)) expect(el, word).not.toHaveClass(word);
}

describe('className (the structure plus the resolved motion)', () => {
  it('holds the collapse structure and the default motion, after the caller’s stable class', () => {
    render(<Disclosure open />);
    const el = wrapper();
    expect(el).toHaveClass(...motionClasses(collapseStructure), ...motionClasses(collapseMotion));
    expect(el?.className).toBe(cn('test-stable', collapseStructure, collapseMotion));
  });

  it('null keeps the structure and drops the motion', () => {
    render(<Disclosure open motion={null} />);
    expect(wrapper()).toHaveClass(...motionClasses(collapseStructure));
    expectNoWordOf(wrapper(), collapseMotion);
    expect(wrapper()).toHaveAttribute('data-presence', 'entered');
  });

  it.each<[string, MotionSlot]>([
    ['a string', 'my-motion'],
    ['{ className }', { className: 'my-motion' }],
  ])('%s replaces the motion and keeps the structure', (_, slot) => {
    render(<Disclosure open motion={slot} />);
    expect(wrapper()).toHaveClass(...motionClasses(collapseStructure), 'my-motion');
    expectNoWordOf(wrapper(), collapseMotion);
  });

  it('the provider’s none drops the default motion; an own motion still applies', () => {
    const { rerender } = renderWithProviders(<Disclosure open />, { motion: 'none' });
    expect(wrapper()).toHaveClass(...motionClasses(collapseStructure));
    expectNoWordOf(wrapper(), collapseMotion);
    rerender(<Disclosure open motion="my-motion" />);
    expect(wrapper()).toHaveClass(...motionClasses(collapseStructure), 'my-motion');
  });
});

describe('phases (no appear, D9)', () => {
  it('an open part mounts entered, with no enter motion; a closed one is not mounted', () => {
    const motion = mockAnimations({ animated: isWrapper });
    const { unmount } = render(<Disclosure open />);
    expect(wrapper()).toHaveAttribute('data-presence', 'entered');
    expect(wrapper()).toHaveAttribute('data-phase', 'entered');
    expect(motion.started).toBe(0);
    unmount();
    render(<Disclosure open={false} />);
    expect(wrapper()).toBeNull();
  });

  it('enters and exits with the wrapper’s motion; phase and the attribute agree', async () => {
    const motion = mockAnimations({ animated: isWrapper });
    const { rerender } = render(<Disclosure open={false} />);
    expect(wrapper()).toBeNull();

    rerender(<Disclosure open />);
    expect(wrapper()).toHaveAttribute('data-presence', 'entering');
    expect(wrapper()).toHaveAttribute('data-phase', 'entering');
    await finish(motion);
    expect(wrapper()).toHaveAttribute('data-presence', 'entered');

    rerender(<Disclosure open={false} />);
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
    expect(wrapper()).toHaveAttribute('data-phase', 'exiting');
    expect(wrapper()).toHaveAttribute('inert');
    await finish(motion);
    expect(wrapper()).toBeNull();
  });

  it('reopened while it exits: the same part, entering, not inert, its state kept', async () => {
    const motion = mockAnimations({ animated: isWrapper });
    const user = userEvent.setup();
    const { rerender } = render(<Disclosure open />);
    await user.type(input(), 'kept');
    // Focus out of the typed input first: this case is about the part's state. (A focus move out
    // of it inside the closing commit makes user-event dispatch its change-on-blur in a nested
    // act(), which React's act queue does not survive in jsdom.)
    await user.click(button('Elsewhere'));
    const part = screen.getByTestId('part');

    rerender(<Disclosure open={false} />);
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
    rerender(<Disclosure open />);
    expect(screen.getByTestId('part')).toBe(part);
    expect(wrapper()).toHaveAttribute('data-presence', 'entering');
    expect(wrapper()).not.toHaveAttribute('inert');
    expect(input()).toHaveValue('kept');
    await finish(motion);
    expect(wrapper()).toHaveAttribute('data-presence', 'entered');
  });

  it('under reduced motion a close removes the part within the same act', () => {
    mockAnimations({ animated: isWrapper });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const { rerender } = render(<Disclosure open />);
    rerender(<Disclosure open={false} />);
    expect(wrapper()).toBeNull();
  });

  it('without reduced motion the same close waits for the wrapper’s motion', async () => {
    const motion = mockAnimations({ animated: isWrapper });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const { rerender } = render(<Disclosure open />);
    rerender(<Disclosure open={false} />);
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
    await finish(motion);
    expect(wrapper()).toBeNull();
  });
});

describe('focus inside the part when it closes (§2.5)', () => {
  it('moves to the trigger in the closing commit, while the part exits', async () => {
    const motion = mockAnimations({ animated: isWrapper });
    honourInert();
    const { rerender } = render(<Disclosure open />);
    act(() => input().focus());
    expect(input()).toHaveFocus();

    rerender(<Disclosure open={false} />);
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
    expect(input().closest('[inert]')).toBe(wrapper());
    expect(button('Toggle')).toHaveFocus();
    await finish(motion);
    expect(wrapper()).toBeNull();
    expect(button('Toggle')).toHaveFocus();
  });

  it('moves to the trigger with no motion too, before the part unmounts', () => {
    honourInert();
    const { rerender } = render(<Disclosure open motion={null} />);
    act(() => input().focus());
    rerender(<Disclosure open={false} motion={null} />);
    expect(wrapper()).toBeNull();
    expect(button('Toggle')).toHaveFocus();
  });

  it('leaves focus outside the part where it is', async () => {
    const motion = mockAnimations({ animated: isWrapper });
    honourInert();
    const { rerender } = render(<Disclosure open />);
    act(() => button('Elsewhere').focus());
    rerender(<Disclosure open={false} />);
    expect(button('Elsewhere')).toHaveFocus();
    await finish(motion);
    expect(button('Elsewhere')).toHaveFocus();
  });

  it('StrictMode: an autofocused input of a part open at mount keeps focus', async () => {
    honourInert();
    render(
      <React.StrictMode>
        <Disclosure open autoFocus />
      </React.StrictMode>,
    );
    await act(async () => {});
    expect(input()).toHaveFocus();
  });
});
