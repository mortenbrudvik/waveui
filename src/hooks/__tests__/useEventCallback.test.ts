import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEventCallback } from '../useEventCallback';

describe('useEventCallback', () => {
  it('returns a stable function identity across renders', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    const { result, rerender } = renderHook(({ fn }) => useEventCallback(fn), {
      initialProps: { fn: fn1 },
    });

    const first = result.current;
    rerender({ fn: fn2 });
    const second = result.current;

    expect(first).toBe(second);
  });

  it('always calls the latest function', () => {
    const fn1 = vi.fn(() => 'first');
    const fn2 = vi.fn(() => 'second');

    const { result, rerender } = renderHook(({ fn }) => useEventCallback(fn), {
      initialProps: { fn: fn1 },
    });

    result.current();
    expect(fn1).toHaveBeenCalledTimes(1);

    rerender({ fn: fn2 });
    result.current();
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('forwards arguments and returns the result', () => {
    const { result } = renderHook(() => useEventCallback((a: number, b: number) => a + b));
    expect(result.current(2, 3)).toBe(5);
  });

  it('handles undefined gracefully and returns undefined', () => {
    const { result } = renderHook(() => useEventCallback(undefined));
    expect(() => result.current()).not.toThrow();
    expect(result.current()).toBeUndefined();
  });

  it('switches between a function and undefined', () => {
    const fn = vi.fn(() => 1);
    const { result, rerender } = renderHook(
      ({ cb }: { cb: (() => number) | undefined }) => useEventCallback(cb),
      { initialProps: { cb: fn as (() => number) | undefined } },
    );
    expect(result.current()).toBe(1);
    rerender({ cb: undefined });
    expect(result.current()).toBeUndefined();
  });

  describe('types (table-core#31)', () => {
    it('keeps the exact signature for a required callback', () => {
      const { result } = renderHook(() =>
        useEventCallback((value: string, index: number) => value.length + index),
      );
      expectTypeOf(result.current).toEqualTypeOf<(value: string, index: number) => number>();
    });

    it('adds undefined to the return type for an optional callback', () => {
      const optional = undefined as ((value: string) => number) | undefined;
      const { result } = renderHook(() => useEventCallback(optional));
      expectTypeOf(result.current).toEqualTypeOf<(value: string) => number | undefined>();
      expectTypeOf(result.current).returns.toEqualTypeOf<number | undefined>();
    });

    it('rejects wrong arguments', () => {
      const { result } = renderHook(() => useEventCallback((value: string) => value));
      // @ts-expect-error a number is not a string
      result.current(1);
      // @ts-expect-error the argument is required
      result.current();
    });

    it('accepts the 0.4 explicit function type argument, which types an inline lambda', () => {
      const { result } = renderHook(() =>
        useEventCallback<(value: string, index: number) => number>(
          (value, index) => value.length + index,
        ),
      );
      expectTypeOf(result.current).toEqualTypeOf<(value: string, index: number) => number>();
      expect(result.current('ab', 1)).toBe(3);
    });

    it('accepts an explicit function type argument for an optional callback', () => {
      const optional = undefined as ((value: string) => number) | undefined;
      const { result } = renderHook(() => useEventCallback<(value: string) => number>(optional));
      expectTypeOf(result.current).toEqualTypeOf<(value: string) => number | undefined>();
      expect(result.current('a')).toBeUndefined();
    });

    it('keeps the overloads and generic signature of a required callback', () => {
      function format(value: string): string;
      function format(value: number): number;
      function format(value: string | number): string | number {
        return value;
      }
      const { result } = renderHook(() => useEventCallback(format));
      expectTypeOf(result.current).toEqualTypeOf<typeof format>();
      expectTypeOf(result.current(1)).toEqualTypeOf<number>();
      expectTypeOf(result.current('a')).toEqualTypeOf<string>();

      const identity = <V>(value: V): V => value;
      const { result: generic } = renderHook(() => {
        // A statement, as in a component: returned directly, renderHook's inferred result type
        // would be the contextual type of the call, and TypeScript would instantiate `V` there.
        const stable = useEventCallback(identity);
        return stable;
      });
      expectTypeOf(generic.current).toEqualTypeOf<typeof identity>();
      expectTypeOf(generic.current(true)).toEqualTypeOf<boolean>();
      expect(generic.current(true)).toBe(true);
    });
  });
});
