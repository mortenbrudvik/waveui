import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useId } from '../useId';

describe('useId', () => {
  it('returns a string', () => {
    const { result } = renderHook(() => useId());
    expect(typeof result.current).toBe('string');
    expect(result.current.length).toBeGreaterThan(0);
  });

  it('applies optional prefix', () => {
    const { result } = renderHook(() => useId('my-prefix'));
    expect(result.current).toMatch(/^my-prefix-/);
  });

  it('returns unique IDs for different instances', () => {
    const { result: r1 } = renderHook(() => useId());
    const { result: r2 } = renderHook(() => useId());
    expect(r1.current).not.toBe(r2.current);
  });
});
