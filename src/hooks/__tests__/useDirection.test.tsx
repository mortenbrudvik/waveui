import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, renderHook, screen, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import * as React from 'react';
import { useDirection } from '../useDirection';
import { WaveProvider } from '../../components/provider/WaveProvider';

function Probe() {
  return <span data-testid="dir">{useDirection()}</span>;
}

describe('useDirection', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('dir');
    document.dir = '';
  });

  it('returns the WaveProvider direction', () => {
    render(
      <WaveProvider dir="rtl">
        <Probe />
      </WaveProvider>,
    );
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
  });

  it('returns the nearest provider direction when providers are nested', () => {
    render(
      <WaveProvider dir="rtl">
        <WaveProvider dir="ltr">
          <Probe />
        </WaveProvider>
      </WaveProvider>,
    );
    expect(screen.getByTestId('dir')).toHaveTextContent('ltr');
  });

  it('defaults to ltr outside a provider', () => {
    const { result } = renderHook(() => useDirection());
    expect(result.current).toBe('ltr');
  });

  it('falls back to the document direction outside a provider (<html dir="rtl">)', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const { result } = renderHook(() => useDirection());
    expect(result.current).toBe('rtl');
  });

  it('follows a change of the document direction outside a provider', async () => {
    const { result } = renderHook(() => useDirection());
    expect(result.current).toBe('ltr');
    await act(async () => {
      document.documentElement.setAttribute('dir', 'rtl');
      // the MutationObserver callback runs in a microtask
      await Promise.resolve();
    });
    expect(result.current).toBe('rtl');
  });

  it('prefers the provider over the document direction', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    render(
      <WaveProvider dir="ltr">
        <Probe />
      </WaveProvider>,
    );
    expect(screen.getByTestId('dir')).toHaveTextContent('ltr');
  });

  it('is ltr on the server', () => {
    expect(renderToString(<Probe />)).toContain('ltr');
  });

  describe('inside a provider (button-provider#28)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function documentObserveCalls(spy: { mock: { calls: unknown[][] } }) {
      return spy.mock.calls.filter(
        ([target]) => target === document.documentElement || target === document.body,
      );
    }

    it('does not observe the document or compute its direction', () => {
      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');
      const styleSpy = vi.spyOn(window, 'getComputedStyle');
      const { rerender } = render(
        <WaveProvider dir="rtl">
          <Probe />
        </WaveProvider>,
      );
      rerender(
        <WaveProvider dir="rtl">
          <Probe />
          <Probe />
        </WaveProvider>,
      );
      expect(documentObserveCalls(observeSpy)).toHaveLength(0);
      expect(
        styleSpy.mock.calls.filter(
          ([el]) => el === document.body || el === document.documentElement,
        ),
      ).toHaveLength(0);
    });

    it('still observes the document outside a provider', () => {
      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');
      renderHook(() => useDirection());
      expect(documentObserveCalls(observeSpy).length).toBeGreaterThan(0);
    });
  });
});
