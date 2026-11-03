import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useTimeout } from '../useTimeout';
import { useAnimationFrame } from '../useAnimationFrame';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useTimeout (foundation-41)', () => {
  it('runs the callback after the delay and returns the timer id', () => {
    const { result } = renderHook(() => useTimeout());
    const callback = vi.fn();
    const id = result.current[0](callback, 100);
    expect(id).toBeDefined();
    act(() => void vi.advanceTimersByTime(99));
    expect(callback).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('replaces the pending timeout instead of setting it twice', () => {
    const { result } = renderHook(() => useTimeout());
    const first = vi.fn();
    const second = vi.fn();
    result.current[0](first, 100);
    result.current[0](second, 100);
    act(() => void vi.advanceTimersByTime(200));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('clears the pending timeout, and clearing with none pending does nothing', () => {
    const { result } = renderHook(() => useTimeout());
    const callback = vi.fn();
    result.current[1]();
    result.current[0](callback, 50);
    result.current[1]();
    act(() => void vi.advanceTimersByTime(100));
    expect(callback).not.toHaveBeenCalled();
  });

  it('cancels the pending timeout on unmount', () => {
    const { result, unmount } = renderHook(() => useTimeout());
    const callback = vi.fn();
    result.current[0](callback, 50);
    unmount();
    act(() => void vi.advanceTimersByTime(100));
    expect(callback).not.toHaveBeenCalled();
  });

  it('keeps the identity of the pair and of both functions between renders', () => {
    const { result, rerender } = renderHook(() => useTimeout());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(result.current[0]).toBe(first[0]);
    expect(result.current[1]).toBe(first[1]);
  });

  it('fires once under StrictMode', () => {
    const callback = vi.fn();
    function Probe() {
      const [set] = useTimeout();
      React.useEffect(() => {
        set(callback, 10);
      }, [set]);
      return null;
    }
    render(
      <React.StrictMode>
        <Probe />
      </React.StrictMode>,
    );
    act(() => void vi.advanceTimersByTime(50));
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('useAnimationFrame (foundation-41)', () => {
  it('runs the callback in the next frame and replaces a pending request', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const { result } = renderHook(() => useAnimationFrame());
    const first = vi.fn();
    const second = vi.fn();
    expect(result.current[0](first)).toBe(1);
    expect(result.current[0](second)).toBe(2);
    expect(cancel).toHaveBeenCalledWith(1);
    frames[1]!(16);
    expect(second).toHaveBeenCalledWith(16);
  });

  it('cancels the pending frame on unmount and on cancel()', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useAnimationFrame());
    result.current[0](() => {});
    result.current[1]();
    expect(cancel).toHaveBeenCalledWith(7);
    cancel.mockClear();
    result.current[1]();
    expect(cancel).not.toHaveBeenCalled();
    result.current[0](() => {});
    unmount();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it('keeps the identity of the pair between renders', () => {
    const { result, rerender } = renderHook(() => useAnimationFrame());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe('the timer hooks on the server', () => {
  function Probe() {
    const [setTimer] = useTimeout();
    const [request] = useAnimationFrame();
    return <span>{`${setTimer(() => {}, 1)}:${request(() => {})}`}</span>;
  }

  it('their functions do nothing and return -1 without a window', () => {
    // The hooks read the global at call time: with no `window`, as on the server, nothing is
    // scheduled and the render does not throw.
    vi.stubGlobal('window', undefined);
    try {
      expect(renderToString(<Probe />)).toContain('-1:-1');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
