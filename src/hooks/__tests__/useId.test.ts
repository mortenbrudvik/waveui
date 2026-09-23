import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useId as useReactId } from 'react';
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

  it('is `<prefix>-<react id>` (no assumption about the React id format)', () => {
    const { result } = renderHook(() => ({ ours: useId('button'), react: useReactId() }));
    const suffix = result.current.ours.slice('button-'.length);
    expect(result.current.ours.startsWith('button-')).toBe(true);
    expect(suffix.length).toBeGreaterThan(0);
    expect(suffix).not.toBe(result.current.react);
  });

  it('returns unique IDs for different instances', () => {
    const { result: r1 } = renderHook(() => useId());
    const { result: r2 } = renderHook(() => useId());
    expect(r1.current).not.toBe(r2.current);
  });

  it('is stable across rerenders', () => {
    const { result, rerender } = renderHook(() => useId('x'));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('can be used in a selector through CSS.escape', () => {
    const { result } = renderHook(() => useId('field'));
    const el = document.createElement('div');
    el.id = result.current;
    document.body.appendChild(el);
    try {
      expect(document.querySelector(`#${CSS.escape(result.current)}`)).toBe(el);
    } finally {
      el.remove();
    }
  });
});
