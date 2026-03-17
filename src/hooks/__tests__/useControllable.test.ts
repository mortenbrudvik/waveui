import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useControllable } from '../useControllable';

describe('useControllable', () => {
  it('uses defaultValue when uncontrolled', () => {
    const { result } = renderHook(() => useControllable(undefined, 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('uses controlled value when provided', () => {
    const { result } = renderHook(() => useControllable('controlled', 'default'));
    expect(result.current[0]).toBe('controlled');
  });

  it('updates internal state in uncontrolled mode', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllable(undefined, 'initial', onChange));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(onChange).toHaveBeenCalledWith('updated');
  });

  it('fires onChange in controlled mode but does not update internal state', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllable('controlled', 'default', onChange));

    act(() => {
      result.current[1]('new-value');
    });

    // Still shows controlled value
    expect(result.current[0]).toBe('controlled');
    expect(onChange).toHaveBeenCalledWith('new-value');
  });

  it('warns when switching from controlled to uncontrolled', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { rerender } = renderHook(({ value }) => useControllable(value, 'default'), {
      initialProps: { value: 'controlled' as string | undefined },
    });

    rerender({ value: undefined });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('controlled'),
      expect.any(String),
      expect.any(String),
    );

    warnSpy.mockRestore();
  });
});
