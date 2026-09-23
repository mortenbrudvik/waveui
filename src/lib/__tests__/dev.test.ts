import { describe, it, expect, afterEach, beforeEach, vi, type MockInstance } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  isDev,
  devWarn,
  warnOnce,
  warnDeprecated,
  resolveDeprecatedProp,
  __resetWarnings,
} from '../dev';

let warnSpy: MockInstance<typeof console.warn>;

beforeEach(() => {
  __resetWarnings();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.unstubAllEnvs();
  __resetWarnings();
});

describe('isDev', () => {
  it('is true outside production (vitest runs with NODE_ENV=test)', () => {
    expect(isDev).toBe(true);
  });

  it('is false when the module is evaluated with NODE_ENV=production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const prod = await import('../dev');
    expect(prod.isDev).toBe(false);
  });
});

describe('devWarn', () => {
  it('prefixes the message with [WaveUI]', () => {
    devWarn('Something is off.');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('[WaveUI] Something is off.');
  });

  it('does not deduplicate', () => {
    devWarn('again');
    devWarn('again');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('is a no-op in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    devWarn('hidden');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('warnOnce', () => {
  it('warns once per key', () => {
    warnOnce('key-a', 'first');
    warnOnce('key-a', 'first');
    warnOnce('key-b', 'second');
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenNthCalledWith(1, '[WaveUI] first');
    expect(warnSpy).toHaveBeenNthCalledWith(2, '[WaveUI] second');
  });

  it('warns again after __resetWarnings()', () => {
    warnOnce('key-a', 'first');
    __resetWarnings();
    warnOnce('key-a', 'first');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps the warn-once set in the global registry so every library copy shares it', async () => {
    warnOnce('shared-key', 'from copy one');
    vi.resetModules();
    const otherCopy = await import('../dev');
    otherCopy.warnOnce('shared-key', 'from copy two');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const registry = (globalThis as unknown as Record<symbol, unknown>)[
      Symbol.for('@mortenbrudvik/waveui/warnings')
    ];
    expect(registry).toBeInstanceOf(Set);
    expect((registry as Set<string>).has('shared-key')).toBe(true);
  });

  it('is a no-op in production and does not consume the key', () => {
    vi.stubEnv('NODE_ENV', 'production');
    warnOnce('key-p', 'hidden');
    expect(warnSpy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    warnOnce('key-p', 'shown');
    expect(warnSpy).toHaveBeenCalledWith('[WaveUI] shown');
  });
});

describe('warnDeprecated', () => {
  it('uses the §5.10 message format', () => {
    warnDeprecated('TabList', 'selectedValue', 'value');
    expect(warnSpy).toHaveBeenCalledWith(
      '[WaveUI] TabList: `selectedValue` is deprecated and will be removed in 1.0. Use `value` instead.',
    );
  });

  it('appends extra guidance', () => {
    warnDeprecated(
      'Combobox',
      'onOptionSelect',
      'onValueChange',
      'It still fires on every option activation.',
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[WaveUI] Combobox: `onOptionSelect` is deprecated and will be removed in 1.0. Use `onValueChange` instead. It still fires on every option activation.',
    );
  });

  it('warns once per (component, prop)', () => {
    warnDeprecated('TabList', 'vertical', 'orientation');
    warnDeprecated('TabList', 'vertical', 'orientation');
    warnDeprecated('Stack', 'direction', 'orientation');
    warnDeprecated('TabList', 'onTabSelect', 'onValueChange');
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });
});

describe('resolveDeprecatedProp', () => {
  it('returns the new value without warning when only the new prop is used', () => {
    expect(resolveDeprecatedProp('Stack', 'vertical', undefined, 'direction', 'orientation')).toBe(
      'vertical',
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns the old value and warns once when only the deprecated prop is used', () => {
    expect(
      resolveDeprecatedProp('Stack', undefined, 'horizontal', 'direction', 'orientation'),
    ).toBe('horizontal');
    resolveDeprecatedProp('Stack', undefined, 'horizontal', 'direction', 'orientation');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[WaveUI] Stack: `direction` is deprecated and will be removed in 1.0. Use `orientation` instead.',
    );
  });

  it('lets the new value win when both are given (and still warns about the old one)', () => {
    expect(resolveDeprecatedProp('Skeleton', 'circular', 'rectangular', 'variant', 'shape')).toBe(
      'circular',
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when neither is given', () => {
    expect(
      resolveDeprecatedProp<string>('Link', undefined, undefined, 'variant', 'appearance'),
    ).toBe(undefined);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('treats false and 0 as given values', () => {
    expect(resolveDeprecatedProp('X', false, true, 'old', 'new')).toBe(false);
    expect(resolveDeprecatedProp('Y', undefined, 0, 'old', 'new')).toBe(0);
  });

  it('is safe to call during render: StrictMode double renders and re-renders warn once', () => {
    function Stack(props: { orientation?: string; direction?: string }) {
      const orientation = resolveDeprecatedProp(
        'Stack',
        props.orientation,
        props.direction,
        'direction',
        'orientation',
      );
      return React.createElement('div', {
        'data-testid': 'stack',
        'data-orientation': orientation,
      });
    }
    const ui = (direction: string) =>
      React.createElement(React.StrictMode, null, React.createElement(Stack, { direction }));
    const { rerender } = render(ui('horizontal'));
    rerender(ui('vertical'));
    expect(screen.getByTestId('stack')).toHaveAttribute('data-orientation', 'vertical');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
