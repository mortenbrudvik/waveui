import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  usePresence,
  type PresenceAttributes,
  type PresencePhase,
  type UsePresenceOptions,
  type UsePresenceResult,
} from '../usePresence';
import { mockAnimations, mockMatchMedia } from '../../test-utils';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Renders one element through the core. `motion` marks it `data-test-motion`, the element
 * `mockAnimations()` animates while it enters or exits.
 */
function Harness({
  visible,
  motion = false,
  style,
  ...options
}: UsePresenceOptions & { visible: boolean; motion?: boolean; style?: React.CSSProperties }) {
  const { isMounted, ref, presenceProps } = usePresence(visible, options);
  if (!isMounted) return null;
  return (
    <div
      data-testid="el"
      data-test-motion={motion ? '' : undefined}
      style={style}
      ref={ref}
      {...presenceProps}
    >
      Content
    </div>
  );
}

const element = () => screen.queryByTestId('el');
const phaseOf = () => element()?.getAttribute('data-presence') ?? null;

describe('usePresence', () => {
  // Every warning and error is asserted: none is expected in this file.
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
      warn.mockRestore();
      error.mockRestore();
    }
  });

  describe('initial phase', () => {
    it('a visible element mounts entered, without inert or hidden', () => {
      render(<Harness visible />);
      expect(phaseOf()).toBe('entered');
      expect(element()).not.toHaveAttribute('inert');
      expect(element()).not.toHaveAttribute('hidden');
    });

    it('a hidden element is not mounted', () => {
      render(<Harness visible={false} />);
      expect(element()).toBeNull();
    });

    it('unmountOnExit: false keeps a hidden element mounted, exited, hidden and inert', () => {
      render(<Harness visible={false} unmountOnExit={false} />);
      expect(phaseOf()).toBe('exited');
      expect(element()).toHaveAttribute('hidden');
      expect(element()).toHaveAttribute('inert');
    });

    it('appear without motion enters and ends at once, calling onEntered once', () => {
      const onEntered = vi.fn();
      render(<Harness visible appear onEntered={onEntered} />);
      expect(phaseOf()).toBe('entered');
      expect(onEntered).toHaveBeenCalledTimes(1);
    });

    it('appear with motion stays entering until the animation finishes', async () => {
      const motion = mockAnimations();
      const onEntered = vi.fn();
      render(<Harness visible appear motion onEntered={onEntered} />);
      expect(phaseOf()).toBe('entering');
      expect(element()).not.toHaveAttribute('inert');
      expect(onEntered).not.toHaveBeenCalled();
      await act(async () => {
        await motion.finishAll();
      });
      expect(phaseOf()).toBe('entered');
      expect(onEntered).toHaveBeenCalledTimes(1);
    });

    it('without appear, a visible element does not run its enter phase on mount', () => {
      const motion = mockAnimations();
      const onEntered = vi.fn();
      render(<Harness visible motion onEntered={onEntered} />);
      expect(phaseOf()).toBe('entered');
      expect(motion.started).toBe(0);
      expect(onEntered).not.toHaveBeenCalled();
    });
  });

  describe('without motion', () => {
    it('hiding removes the element in the same act() and calls onExited once', () => {
      const onExited = vi.fn();
      const { rerender } = render(<Harness visible onExited={onExited} />);
      act(() => rerender(<Harness visible={false} onExited={onExited} />));
      expect(element()).toBeNull();
      expect(onExited).toHaveBeenCalledTimes(1);
    });

    it('showing enters and ends at once, calling onEntered once', () => {
      const onEntered = vi.fn();
      const { rerender } = render(<Harness visible={false} onEntered={onEntered} />);
      act(() => rerender(<Harness visible onEntered={onEntered} />));
      expect(phaseOf()).toBe('entered');
      expect(onEntered).toHaveBeenCalledTimes(1);
    });

    it('unmountOnExit: false hides the element instead, keeping its DOM', () => {
      const onExited = vi.fn();
      const { rerender } = render(<Harness visible unmountOnExit={false} onExited={onExited} />);
      const el = element();
      act(() => rerender(<Harness visible={false} unmountOnExit={false} onExited={onExited} />));
      expect(element()).toBe(el);
      expect(phaseOf()).toBe('exited');
      expect(el).toHaveAttribute('hidden');
      expect(el).toHaveAttribute('inert');
      expect(onExited).toHaveBeenCalledTimes(1);

      act(() => rerender(<Harness visible unmountOnExit={false} onExited={onExited} />));
      expect(element()).toBe(el);
      expect(phaseOf()).toBe('entered');
      expect(el).not.toHaveAttribute('hidden');
      expect(el).not.toHaveAttribute('inert');
    });
  });

  describe('with motion (mockAnimations)', () => {
    it('keeps the exiting element mounted and inert until its animation finishes', async () => {
      const motion = mockAnimations();
      const onExited = vi.fn();
      const { rerender } = render(<Harness visible motion onExited={onExited} />);
      act(() => rerender(<Harness visible={false} motion onExited={onExited} />));
      expect(phaseOf()).toBe('exiting');
      expect(element()).toHaveAttribute('inert');
      expect(element()).not.toHaveAttribute('hidden');
      expect(motion.started).toBe(1);
      expect(onExited).not.toHaveBeenCalled();

      await act(async () => {
        await motion.finishAll();
      });
      expect(element()).toBeNull();
      expect(onExited).toHaveBeenCalledTimes(1);
    });

    it('a cancelled animation ends the phase', async () => {
      const motion = mockAnimations();
      const { rerender } = render(<Harness visible motion />);
      act(() => rerender(<Harness visible={false} motion />));
      expect(phaseOf()).toBe('exiting');
      await act(async () => {
        await motion.cancelAll();
      });
      expect(element()).toBeNull();
    });

    it('showing again during the exit returns to entering on the same element, without onExited', async () => {
      const motion = mockAnimations();
      const onExited = vi.fn();
      const onEntered = vi.fn();
      const props = { motion: true, onExited, onEntered };
      const { rerender } = render(<Harness visible {...props} />);
      const el = element();
      act(() => rerender(<Harness visible={false} {...props} />));
      expect(phaseOf()).toBe('exiting');

      act(() => rerender(<Harness visible {...props} />));
      expect(element()).toBe(el);
      expect(phaseOf()).toBe('entering');
      expect(el).not.toHaveAttribute('inert');

      await act(async () => {
        await motion.finishAll();
      });
      expect(element()).toBe(el);
      expect(phaseOf()).toBe('entered');
      expect(onExited).not.toHaveBeenCalled();
      expect(onEntered).toHaveBeenCalledTimes(1);
    });

    it('a replaced phase never ends the new one (the exit animation finishing late)', async () => {
      // Each call hands out a new animation: the exit's, then the enter's.
      const finishers: Array<() => void> = [];
      const getAnimations = vi.fn(() => {
        let finish!: () => void;
        const finished = new Promise<Animation>((resolve) => {
          finish = () => resolve(animation);
        });
        const animation = {
          playState: 'running',
          finished,
          effect: { getComputedTiming: () => ({ endTime: 200 }) },
        } as unknown as Animation;
        finishers.push(finish);
        return [animation];
      });
      const proto = Element.prototype as { getAnimations?: () => Animation[] };
      Object.defineProperty(proto, 'getAnimations', {
        configurable: true,
        writable: true,
        value: getAnimations,
      });
      try {
        const { rerender } = render(<Harness visible />);
        act(() => rerender(<Harness visible={false} />));
        act(() => rerender(<Harness visible />));
        expect(phaseOf()).toBe('entering');
        expect(finishers).toHaveLength(2);

        // The exit's animation finishing late does not end the enter phase.
        await act(async () => {
          finishers[0]();
        });
        expect(phaseOf()).toBe('entering');
        await act(async () => {
          finishers[1]();
        });
        expect(phaseOf()).toBe('entered');
      } finally {
        Reflect.deleteProperty(proto, 'getAnimations');
      }
    });

    it('ignores an animation with an infinite end time, and one that is not running', () => {
      const proto = Element.prototype as { getAnimations?: () => Animation[] };
      const animation = (endTime: number, playState: AnimationPlayState) =>
        ({
          playState,
          finished: new Promise(() => {}),
          effect: { getComputedTiming: () => ({ endTime }) },
        }) as unknown as Animation;
      const getAnimations = vi.fn(() => [
        animation(Infinity, 'running'),
        animation(200, 'paused'),
        animation(200, 'finished'),
      ]);
      Object.defineProperty(proto, 'getAnimations', {
        configurable: true,
        writable: true,
        value: getAnimations,
      });
      try {
        const { rerender } = render(<Harness visible />);
        act(() => rerender(<Harness visible={false} />));
        expect(getAnimations).toHaveBeenCalled();
        expect(element()).toBeNull();
      } finally {
        Reflect.deleteProperty(proto, 'getAnimations');
      }
    });

    it('waits only for the element’s own animations', () => {
      const motion = mockAnimations({ animated: (el) => el.id === 'child' });
      function WithChild({ visible }: { visible: boolean }) {
        const { isMounted, ref, presenceProps } = usePresence(visible);
        if (!isMounted) return null;
        return (
          <div data-testid="el" ref={ref} {...presenceProps}>
            <span id="child" />
          </div>
        );
      }
      const { rerender } = render(<WithChild visible />);
      act(() => rerender(<WithChild visible={false} />));
      expect(element()).toBeNull();
      expect(motion.started).toBe(0);
    });
  });

  describe('reduced motion', () => {
    it('ends the phases at once while an animation runs', () => {
      mockMatchMedia({ [REDUCED_MOTION]: true });
      const motion = mockAnimations({ animated: () => true });
      const onExited = vi.fn();
      const { rerender } = render(<Harness visible appear onExited={onExited} />);
      expect(phaseOf()).toBe('entered');
      act(() => rerender(<Harness visible={false} appear onExited={onExited} />));
      expect(element()).toBeNull();
      expect(onExited).toHaveBeenCalledTimes(1);
      expect(motion.started).toBe(0);
    });

    it('waits for the animation when reduced motion is not requested', () => {
      mockMatchMedia({ [REDUCED_MOTION]: false });
      mockAnimations({ animated: () => true });
      const { rerender } = render(<Harness visible />);
      act(() => rerender(<Harness visible={false} />));
      expect(phaseOf()).toBe('exiting');
    });
  });

  describe('without getAnimations: the computed style', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const fade: React.CSSProperties = { animationName: 'fade', animationDuration: '200ms' };

    it('ends at the longest animation time plus 50 ms', () => {
      const { rerender } = render(<Harness visible style={fade} />);
      act(() => rerender(<Harness visible={false} style={fade} />));
      expect(phaseOf()).toBe('exiting');
      act(() => {
        vi.advanceTimersByTime(249);
      });
      expect(phaseOf()).toBe('exiting');
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(element()).toBeNull();
    });

    it('counts delays, iterations and transitions, and ignores infinite animations', () => {
      const style: React.CSSProperties = {
        animationName: 'fade, spin',
        animationDuration: '100ms, 1s',
        animationDelay: '0.05s',
        animationIterationCount: '2, infinite',
        transitionProperty: 'opacity',
        transitionDuration: '300ms',
        transitionDelay: '100ms',
      };
      const { rerender } = render(<Harness visible style={style} />);
      act(() => rerender(<Harness visible={false} style={style} />));
      // fade: 50 + 100 × 2 = 250 ms; the transition: 100 + 300 = 400 ms; spin never ends.
      act(() => {
        vi.advanceTimersByTime(449);
      });
      expect(phaseOf()).toBe('exiting');
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(element()).toBeNull();
    });

    it('ends earlier once the element’s own end events account for every animation and transition', () => {
      const style: React.CSSProperties = {
        ...fade,
        transitionProperty: 'opacity, translate',
        transitionDuration: '150ms',
      };
      const { rerender } = render(<Harness visible style={style} />);
      act(() => rerender(<Harness visible={false} style={style} />));
      const el = element()!;
      const animationEnd = (name: string, target: Element = el) => {
        const event = new Event('animationend', { bubbles: true });
        Object.defineProperty(event, 'animationName', { value: name });
        act(() => {
          target.dispatchEvent(event);
        });
      };
      const transitionEnd = (property: string) =>
        act(() => {
          el.dispatchEvent(new TransitionEvent('transitionend', { propertyName: property }));
        });

      // A child's event does not count.
      const child = document.createElement('i');
      el.append(child);
      animationEnd('fade', child);
      animationEnd('fade');
      transitionEnd('opacity');
      expect(phaseOf()).toBe('exiting');
      transitionEnd('translate');
      expect(element()).toBeNull();
    });

    it('a cancel event counts as the end', () => {
      const { rerender } = render(<Harness visible style={fade} />);
      act(() => rerender(<Harness visible={false} style={fade} />));
      const event = new Event('animationcancel');
      Object.defineProperty(event, 'animationName', { value: 'fade' });
      act(() => {
        element()!.dispatchEvent(event);
      });
      expect(element()).toBeNull();
    });

    it('ends at once when the style lists no motion', () => {
      const style: React.CSSProperties = {
        animationName: 'none',
        transitionProperty: 'opacity',
        transitionDuration: '0s',
      };
      const { rerender } = render(<Harness visible style={style} />);
      act(() => rerender(<Harness visible={false} style={style} />));
      expect(element()).toBeNull();
    });
  });

  it('calls each callback once per phase under StrictMode', async () => {
    const motion = mockAnimations();
    const onEntered = vi.fn();
    const onExited = vi.fn();
    const props = { onEntered, onExited, appear: true };
    const { rerender } = render(
      <React.StrictMode>
        <Harness visible {...props} />
      </React.StrictMode>,
    );
    expect(onEntered).toHaveBeenCalledTimes(1);
    act(() =>
      rerender(
        <React.StrictMode>
          <Harness visible={false} {...props} />
        </React.StrictMode>,
      ),
    );
    expect(onExited).toHaveBeenCalledTimes(1);

    act(() =>
      rerender(
        <React.StrictMode>
          <Harness visible motion {...props} />
        </React.StrictMode>,
      ),
    );
    expect(phaseOf()).toBe('entering');
    await act(async () => {
      await motion.finishAll();
    });
    expect(onEntered).toHaveBeenCalledTimes(2);
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it('calls no onExited when the parent unmounts the element while it exits', () => {
    mockAnimations();
    const onExited = vi.fn();
    const { rerender, unmount } = render(<Harness visible motion onExited={onExited} />);
    act(() => rerender(<Harness visible={false} motion onExited={onExited} />));
    expect(phaseOf()).toBe('exiting');
    unmount();
    expect(onExited).not.toHaveBeenCalled();
  });

  it('renders entered on the server, also with appear, and hydrates without replaying it', () => {
    const motion = mockAnimations();
    const onEntered = vi.fn();
    const html = renderToString(<Harness visible appear motion onEntered={onEntered} />);
    expect(html).toContain('data-presence="entered"');
    expect(renderToString(<Harness visible={false} unmountOnExit={false} />)).toMatch(
      /data-presence="exited"[^>]*hidden|hidden[^>]*data-presence="exited"/,
    );

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      act(() => {
        root = hydrateRoot(container, <Harness visible appear motion onEntered={onEntered} />);
      });
      expect(container.querySelector('[data-testid="el"]')).toHaveAttribute(
        'data-presence',
        'entered',
      );
      expect(motion.started).toBe(0);
      expect(onEntered).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });

  it('writes attributes only: no style or class', () => {
    mockAnimations();
    const { rerender } = render(<Harness visible motion />);
    const el = element()!;
    act(() => rerender(<Harness visible={false} motion />));
    expect(phaseOf()).toBe('exiting');
    expect(el).not.toHaveAttribute('style');
    expect(el).not.toHaveAttribute('class');
    expect(el.getAttributeNames().sort()).toEqual(
      ['data-presence', 'data-test-motion', 'data-testid', 'inert'].sort(),
    );
  });

  it('keeps the ref stable and the attribute object stable while the phase holds', () => {
    const results: UsePresenceResult[] = [];
    function Probe({
      visible,
      onResult,
    }: {
      visible: boolean;
      onResult: (result: UsePresenceResult) => void;
    }) {
      const { isMounted, phase, ref, presenceProps } = usePresence(visible);
      React.useLayoutEffect(() => {
        onResult({ isMounted, phase, ref, presenceProps });
      });
      return isMounted ? <div ref={ref} {...presenceProps} /> : null;
    }
    const onResult = (result: UsePresenceResult) => results.push(result);
    const { rerender } = render(<Probe visible onResult={onResult} />);
    rerender(<Probe visible onResult={onResult} />);
    const [first, last] = [results[0], results[results.length - 1]];
    expect(last.ref).toBe(first.ref);
    expect(last.presenceProps).toBe(first.presenceProps);
    expect(last.presenceProps).toEqual({ 'data-presence': 'entered' });
  });

  it('has the documented types', () => {
    expectTypeOf<PresencePhase>().toEqualTypeOf<'entering' | 'entered' | 'exiting' | 'exited'>();
    expectTypeOf<UsePresenceResult['phase']>().toEqualTypeOf<PresencePhase>();
    expectTypeOf<UsePresenceResult['ref']>().toEqualTypeOf<React.RefCallback<HTMLElement>>();
    expectTypeOf<UsePresenceResult['isMounted']>().toEqualTypeOf<boolean>();
    expectTypeOf<UsePresenceResult['presenceProps']>().toEqualTypeOf<PresenceAttributes>();
    expectTypeOf<PresenceAttributes['data-presence']>().toEqualTypeOf<PresencePhase>();
    expectTypeOf<UsePresenceOptions['unmountOnExit']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf(usePresence).parameters.toEqualTypeOf<[boolean, UsePresenceOptions?]>();
  });
});
