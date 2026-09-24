import { describe, it, expect, afterEach, beforeEach, vi, type MockInstance } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  isDev,
  devWarn,
  warnOnce,
  hasWarned,
  warnDeprecated,
  resolveDeprecatedProp,
  reportMissingContext,
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

describe('hasWarned', () => {
  it('hasWarned reports keys consumed by warnOnce without consuming them', () => {
    expect(hasWarned('X:k')).toBe(false);
    expect(hasWarned('X:k')).toBe(false);
    warnOnce('X:k', 'msg');
    expect(hasWarned('X:k')).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    __resetWarnings();
    expect(hasWarned('X:k')).toBe(false);
  });

  it('does not consume the key, so a later warnOnce still warns', () => {
    expect(hasWarned('X:later')).toBe(false);
    warnOnce('X:later', 'still shown');
    expect(warnSpy).toHaveBeenCalledWith('[WaveUI] still shown');
  });

  it('sees keys emitted through warnDeprecated', () => {
    warnDeprecated('TabList', 'vertical', 'orientation');
    expect(hasWarned('deprecated:TabList:vertical')).toBe(true);
    expect(hasWarned('deprecated:TabList:onTabSelect')).toBe(false);
  });

  it('reads the shared global registry, so another library copy sees the key', async () => {
    warnOnce('shared-has-key', 'from copy one');
    vi.resetModules();
    const otherCopy = await import('../dev');
    expect(otherCopy.hasWarned('shared-has-key')).toBe(true);
  });

  it('reports false in production, where warnOnce consumes no key', () => {
    vi.stubEnv('NODE_ENV', 'production');
    warnOnce('key-hp', 'hidden');
    expect(hasWarned('key-hp')).toBe(false);
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

describe('reportMissingContext', () => {
  let errorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('throws "[WaveUI] <component> must be used within <parent>" in development', () => {
    expect(() => reportMissingContext('TabList.Tab', '<TabList>')).toThrow(
      new Error('[WaveUI] TabList.Tab must be used within <TabList>'),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('throws the custom message instead when one is given', () => {
    expect(() =>
      reportMissingContext(
        'useToastController',
        '<Toaster>',
        'useToastController must be used within <Toaster>. Wrap your app in <Toaster>.',
      ),
    ).toThrow(
      new Error(
        '[WaveUI] useToastController must be used within <Toaster>. Wrap your app in <Toaster>.',
      ),
    );
  });

  it('throws on every call in development', () => {
    const message = '[WaveUI] Menu.Item must be used within <Menu>';
    expect(() => reportMissingContext('Menu.Item', '<Menu>')).toThrow(message);
    expect(() => reportMissingContext('Menu.Item', '<Menu>')).toThrow(message);
  });

  it('logs the message with console.error once per text in production, without throwing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => reportMissingContext('TabList.Tab', '<TabList>')).not.toThrow();
    reportMissingContext('TabList.Tab', '<TabList>');
    reportMissingContext('TabList.Tab', '<TabList>');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[WaveUI] TabList.Tab must be used within <TabList>');
  });

  it('logs each different text once in production (other component, other parent, custom message)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    reportMissingContext('TabList.Tab', '<TabList>');
    reportMissingContext('TabList.Panel', '<TabList>');
    reportMissingContext('TabList.Tab', '<TabList.Panels>');
    reportMissingContext('TabList.Tab', '<TabList>', 'Tabs need a TabList.');
    reportMissingContext('TabList.Panel', '<TabList>');
    reportMissingContext('Other', '<Root>', 'Tabs need a TabList.');
    expect(errorSpy.mock.calls).toEqual([
      ['[WaveUI] TabList.Tab must be used within <TabList>'],
      ['[WaveUI] TabList.Panel must be used within <TabList>'],
      ['[WaveUI] TabList.Tab must be used within <TabList.Panels>'],
      ['[WaveUI] Tabs need a TabList.'],
    ]);
  });

  it('logs again after __resetWarnings()', () => {
    vi.stubEnv('NODE_ENV', 'production');
    reportMissingContext('Tree.Item', '<Tree>');
    __resetWarnings();
    reportMissingContext('Tree.Item', '<Tree>');
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('does not record the text in development, so production still logs it', () => {
    expect(() => reportMissingContext('Nav.Item', '<Nav>')).toThrow(
      '[WaveUI] Nav.Item must be used within <Nav>',
    );
    vi.stubEnv('NODE_ENV', 'production');
    reportMissingContext('Nav.Item', '<Nav>');
    expect(errorSpy).toHaveBeenCalledWith('[WaveUI] Nav.Item must be used within <Nav>');
  });

  it('keeps the logged set in the global registry so every library copy shares it', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    reportMissingContext('Accordion.Item', '<Accordion>');
    vi.resetModules();
    const otherCopy = await import('../dev');
    otherCopy.reportMissingContext('Accordion.Item', '<Accordion>');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const registry = (globalThis as unknown as Record<symbol, unknown>)[
      Symbol.for('@mortenbrudvik/waveui/missing-context')
    ];
    expect(registry).toBeInstanceOf(Set);
    expect(
      (registry as Set<string>).has('[WaveUI] Accordion.Item must be used within <Accordion>'),
    ).toBe(true);
  });
});

describe('without a `process` global (lib-provider-tests-2)', () => {
  // An unbundled ESM import in the browser: no bundler replaced `process.env.NODE_ENV` and there is
  // no `process`. Development mode is assumed, so the diagnostics stay on.
  function withoutProcess<T>(run: () => T): T {
    vi.stubGlobal('process', undefined);
    try {
      return run();
    } finally {
      vi.unstubAllGlobals();
    }
  }

  it('the warning helpers still warn', () => {
    withoutProcess(() => {
      devWarn('No process.');
      warnOnce('no-process', 'Once without process.');
      warnOnce('no-process', 'Once without process.');
    });
    expect(warnSpy.mock.calls).toEqual([
      ['[WaveUI] No process.'],
      ['[WaveUI] Once without process.'],
    ]);
  });

  it('reportMissingContext still throws', () => {
    expect(() => withoutProcess(() => reportMissingContext('Tree.Item', '<Tree>'))).toThrow(
      new Error('[WaveUI] Tree.Item must be used within <Tree>'),
    );
  });

  it('isDev is true when the module is evaluated without it', async () => {
    vi.resetModules();
    vi.stubGlobal('process', undefined);
    try {
      const copy = await import('../dev');
      expect(copy.isDev).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
