import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import * as React from 'react';
import { useIsClient } from '../useIsClient';

function Probe({ onRender }: { onRender?: (isClient: boolean) => void }) {
  const isClient = useIsClient();
  onRender?.(isClient);
  return <span data-testid="probe">{isClient ? 'client' : 'server'}</span>;
}

describe('useIsClient', () => {
  it('is true in the first client render (no second commit)', () => {
    const seen: boolean[] = [];
    render(<Probe onRender={(v) => seen.push(v)} />);
    expect(seen).toEqual([true]);
  });

  it('is false on the server', () => {
    expect(renderToString(<Probe />)).toContain('server');
  });

  it('is false during hydration and true right after, without a mismatch', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Probe />);
    document.body.appendChild(container);
    const errorSpy = vi.spyOn(console, 'error');
    const seen: boolean[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <Probe onRender={(v) => seen.push(v)} />);
      });
      expect(seen[0]).toBe(false);
      expect(seen[seen.length - 1]).toBe(true);
      expect(container.textContent).toBe('client');
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
      errorSpy.mockRestore();
    }
  });

  it('stays true across rerenders', () => {
    const { result, rerender } = renderHook(() => useIsClient());
    rerender();
    expect(result.current).toBe(true);
  });
});
