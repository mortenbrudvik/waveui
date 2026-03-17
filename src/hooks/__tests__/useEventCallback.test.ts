import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEventCallback } from '../useEventCallback';

describe('useEventCallback', () => {
  it('returns a stable function identity across renders', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    const { result, rerender } = renderHook(
      ({ fn }) => useEventCallback(fn),
      { initialProps: { fn: fn1 } },
    );

    const first = result.current;
    rerender({ fn: fn2 });
    const second = result.current;

    expect(first).toBe(second);
  });

  it('always calls the latest function', () => {
    const fn1 = vi.fn(() => 'first');
    const fn2 = vi.fn(() => 'second');

    const { result, rerender } = renderHook(
      ({ fn }) => useEventCallback(fn),
      { initialProps: { fn: fn1 } },
    );

    result.current();
    expect(fn1).toHaveBeenCalledTimes(1);

    rerender({ fn: fn2 });
    result.current();
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('handles undefined gracefully', () => {
    const { result } = renderHook(() => useEventCallback(undefined));
    expect(() => result.current()).not.toThrow();
  });
});
