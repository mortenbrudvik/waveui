import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { useMotionClasses, useMotionPreference } from '../useMotion';
import { WaveProvider, type WaveProviderProps } from '../../components/provider/WaveProvider';

function providers(props: Omit<WaveProviderProps, 'children'>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <WaveProvider {...props}>{children}</WaveProvider>;
  };
}

describe('useMotionPreference', () => {
  it('is "default" outside a provider and without the prop', () => {
    expect(renderHook(() => useMotionPreference()).result.current).toBe('default');
    expect(renderHook(() => useMotionPreference(), { wrapper: providers({}) }).result.current).toBe(
      'default',
    );
  });

  it('is "none" under a provider with motion="none"', () => {
    const { result } = renderHook(() => useMotionPreference(), {
      wrapper: providers({ motion: 'none' }),
    });
    expect(result.current).toBe('none');
  });

  it('a nested provider without motion inherits "none"', () => {
    const { result } = renderHook(() => useMotionPreference(), {
      wrapper: ({ children }) => (
        <WaveProvider motion="none">
          <WaveProvider theme="dark">{children}</WaveProvider>
        </WaveProvider>
      ),
    });
    expect(result.current).toBe('none');
  });

  it('a nested motion="default" turns motion back on', () => {
    const { result } = renderHook(() => useMotionPreference(), {
      wrapper: ({ children }) => (
        <WaveProvider motion="none">
          <WaveProvider motion="default">{children}</WaveProvider>
        </WaveProvider>
      ),
    });
    expect(result.current).toBe('default');
  });
});

describe('useMotionClasses', () => {
  it('returns the recipe by default and nothing under "none"', () => {
    expect(renderHook(() => useMotionClasses(undefined, 'r')).result.current).toBe('r');
    expect(
      renderHook(() => useMotionClasses(undefined, 'r'), {
        wrapper: providers({ motion: 'none' }),
      }).result.current,
    ).toBe('');
  });

  it('an own value wins under "none"', () => {
    expect(
      renderHook(() => useMotionClasses('mine', 'r'), { wrapper: providers({ motion: 'none' }) })
        .result.current,
    ).toBe('mine');
  });

  it('null is no motion and a legacy className turns the default off', () => {
    expect(renderHook(() => useMotionClasses(null, 'r')).result.current).toBe('');
    expect(
      renderHook(() => useMotionClasses(undefined, 'r', 'data-[presence=exiting]:opacity-0')).result
        .current,
    ).toBe('');
  });
});
