import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { usePlacedPresence } from '../usePlacedPresence';
import { mockAnimations, mockMatchMedia } from '../../test-utils';

/*
 * The enter of a positioned popup starts in the commit after its resolved side is known: the
 * surface mounts in the exited phase (which the popup recipe styles as the start of the enter),
 * the style of the placed surface is resolved with the resolved side, and the presence core then
 * enters from it.
 */

interface HarnessProps {
  open: boolean;
  placed: boolean;
  hold?: boolean;
  /** The side the surface renders, as `data-side` (the popup's resolved side). */
  side?: string;
}

function Harness({ open, placed, hold = true, side = 'bottom' }: HarnessProps) {
  const { isMounted, ref, presenceProps } = usePlacedPresence(open, placed, hold);
  if (!isMounted) return null;
  return <div data-testid="el" data-test-motion="" data-side={side} ref={ref} {...presenceProps} />;
}

const element = () => screen.queryByTestId('el');
const phaseOf = () => element()?.getAttribute('data-presence') ?? null;

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

/** Every `data-presence` value written to `el` (React writes attributes with `setAttribute`). */
function recordPhases(): { phases: string[] } {
  const record = { phases: [] as string[] };
  const setAttribute = Element.prototype.setAttribute;
  vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (
    this: Element,
    name: string,
    value: string,
  ) {
    if (name === 'data-presence' && this.getAttribute('data-testid') === 'el') {
      record.phases.push(value);
    }
    return setAttribute.call(this, name, value);
  });
  return record;
}

describe('usePlacedPresence', () => {
  it('mounts the surface exited and enters only once it is placed', async () => {
    const motion = mockAnimations();
    const { rerender } = render(<Harness open placed={false} />);
    expect(phaseOf()).toBe('exited');
    expect(element()).not.toHaveAttribute('inert');
    expect(element()).not.toHaveAttribute('hidden');
    // Nothing waits for motion while it is held.
    expect(motion.started).toBe(0);

    rerender(<Harness open placed />);
    expect(phaseOf()).toBe('entering');
    expect(motion.started).toBe(1);

    await act(async () => {
      await motion.finishAll();
    });
    expect(phaseOf()).toBe('entered');
  });

  it('resolves the style with the resolved side while the surface is still exited', () => {
    mockAnimations();
    const seen: Array<{ phase: string | null; side: string | null }> = [];
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      if (el instanceof Element && el.getAttribute('data-testid') === 'el') {
        seen.push({ phase: el.getAttribute('data-presence'), side: el.getAttribute('data-side') });
      }
      return getComputedStyle(el, pseudo);
    });

    // It mounts with the requested side; floating-ui then places it on the other (a flip), in the
    // render that also says it is placed.
    const { rerender } = render(<Harness open placed={false} side="bottom" />);
    seen.length = 0;
    rerender(<Harness open placed side="top" />);

    // The last style resolved before the enter is the exited surface on its resolved side, so the
    // transition starts from there; the enter follows in the next commit.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toEqual({ phase: 'exited', side: 'top' });
    expect(seen.every(({ side }) => side === 'top')).toBe(true);
    expect(phaseOf()).toBe('entering');
    expect(element()).toHaveAttribute('data-side', 'top');
  });

  it('never enters on a side other than the resolved one', () => {
    mockAnimations();
    const entering: Array<string | null> = [];
    const setAttribute = Element.prototype.setAttribute;
    vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (
      this: Element,
      name: string,
      value: string,
    ) {
      setAttribute.call(this, name, value);
      if (name === 'data-presence' && value === 'entering')
        entering.push(this.getAttribute('data-side'));
    });
    const { rerender } = render(<Harness open placed={false} side="bottom" />);
    rerender(<Harness open placed side="top" />);
    expect(entering).toEqual(['top']);
  });

  it('closing before it is placed unmounts at once, without ever entering', () => {
    mockAnimations();
    const record = recordPhases();
    const { rerender } = render(<Harness open placed={false} />);
    expect(element()).not.toBeNull();
    rerender(<Harness open={false} placed={false} />);
    expect(element()).toBeNull();
    expect(record.phases).not.toContain('entering');
    expect(record.phases).not.toContain('exiting');
  });

  it('exits as usePresence does once it has entered, and holds again when it reopens', async () => {
    const motion = mockAnimations();
    const { rerender } = render(<Harness open placed={false} />);
    rerender(<Harness open placed />);
    await act(async () => {
      await motion.finishAll();
    });
    expect(phaseOf()).toBe('entered');

    rerender(<Harness open={false} placed />);
    expect(phaseOf()).toBe('exiting');
    expect(element()).toHaveAttribute('inert');
    await act(async () => {
      await motion.finishAll();
    });
    expect(element()).toBeNull();

    rerender(<Harness open placed={false} />);
    expect(phaseOf()).toBe('exited');
    rerender(<Harness open placed />);
    expect(phaseOf()).toBe('entering');
  });

  it('enters where it is when it is not placed by the next frame', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    mockAnimations();
    render(<Harness open placed={false} />);
    expect(phaseOf()).toBe('exited');
    expect(frames).toHaveLength(1);

    act(() => frames[0](0));
    expect(phaseOf()).toBe('entering');
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('a placed surface cancels the frame it would have waited for', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    mockAnimations();
    const { rerender } = render(<Harness open placed={false} />);
    rerender(<Harness open placed />);
    expect(phaseOf()).toBe('entering');
    expect(cancel).toHaveBeenCalledWith(1);
  });

  it('without a hold it mounts entering, as usePresence with appear', () => {
    const motion = mockAnimations();
    render(<Harness open placed={false} hold={false} />);
    expect(phaseOf()).toBe('entering');
    expect(motion.started).toBe(1);
  });

  it('a surface that is not held and closes while entering exits as usePresence does', async () => {
    const motion = mockAnimations();
    const { rerender } = render(<Harness open placed={false} hold={false} />);
    rerender(<Harness open={false} placed={false} hold={false} />);
    expect(phaseOf()).toBe('exiting');
    await act(async () => {
      await motion.finishAll();
    });
    expect(element()).toBeNull();
  });

  it('under reduced motion it still waits for the position, then enters at once', () => {
    mockAnimations();
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const { rerender } = render(<Harness open placed={false} />);
    expect(phaseOf()).toBe('exited');
    rerender(<Harness open placed />);
    expect(phaseOf()).toBe('entered');
  });

  it('calls nothing twice in StrictMode and ends entered', async () => {
    const motion = mockAnimations();
    const { rerender } = render(
      <React.StrictMode>
        <Harness open placed={false} />
      </React.StrictMode>,
    );
    expect(phaseOf()).toBe('exited');
    rerender(
      <React.StrictMode>
        <Harness open placed />
      </React.StrictMode>,
    );
    expect(phaseOf()).toBe('entering');
    await act(async () => {
      await motion.finishAll();
    });
    expect(phaseOf()).toBe('entered');
  });

  it('is entered on the server and replays no enter when it hydrates', () => {
    const motion = mockAnimations();
    const html = renderToString(<Harness open placed={false} />);
    expect(html).toContain('data-presence="entered"');
    expect(html).not.toContain('inert');

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      const record = recordPhases();
      act(() => {
        root = hydrateRoot(container, <Harness open placed={false} />);
      });
      expect(container.querySelector('[data-testid="el"]')).toHaveAttribute(
        'data-presence',
        'entered',
      );
      expect(record.phases).not.toContain('entering');
      expect(record.phases).not.toContain('exited');
      expect(motion.started).toBe(0);
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });

  it('a surface closed on the server is held when it opens on the client', () => {
    const html = renderToString(<Harness open={false} placed={false} />);
    expect(html).toBe('');
    mockAnimations();
    const { rerender } = render(<Harness open={false} placed={false} />);
    rerender(<Harness open placed={false} />);
    expect(phaseOf()).toBe('exited');
  });
});
