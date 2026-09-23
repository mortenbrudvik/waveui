import { describe, it, expect, vi, beforeEach, afterEach, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import {
  WaveProvider,
  useWaveTheme,
  getThemeClassName,
  type WaveContextValue,
  type WaveTheme,
} from '../WaveProvider';
import { testSystemProps } from '../../../test-utils';
import { __resetWarnings } from '../../../lib/dev';

function root(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

describe('WaveProvider', () => {
  beforeEach(() => {
    __resetWarnings();
  });

  afterEach(() => {
    __resetWarnings();
  });

  testSystemProps(WaveProvider, {
    expectedTag: 'div',
    displayName: 'WaveProvider',
    defaultProps: { children: <span>child</span> },
    a11y: false,
  });

  it('renders children', () => {
    render(<WaveProvider>Hello</WaveProvider>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  describe('theme classes (button-provider#2, button-provider#6, repo-level#7)', () => {
    it('paints background, foreground, font and type ramp on a dark root', () => {
      const { container } = render(<WaveProvider theme="dark">Content</WaveProvider>);
      const el = root(container);
      expect(el).toHaveClass(
        'wave-root',
        'wave-dark',
        'dark',
        'bg-background',
        'text-foreground',
        'font-wave',
        'text-body-1',
      );
      expect(el).toHaveAttribute('data-wave-theme', 'dark');
    });

    it('applies wave-high-contrast plus the legacy high-contrast class', () => {
      const { container } = render(<WaveProvider theme="high-contrast">Content</WaveProvider>);
      const el = root(container);
      expect(el).toHaveClass('wave-root', 'wave-high-contrast', 'high-contrast');
      expect(el).not.toHaveClass('dark', 'wave-dark', 'wave-light');
      expect(el).toHaveAttribute('data-wave-theme', 'high-contrast');
    });

    it('applies wave-light for the default light theme', () => {
      const { container } = render(<WaveProvider>Content</WaveProvider>);
      const el = root(container);
      expect(el).toHaveClass('wave-root', 'wave-light', 'bg-background', 'text-foreground');
      expect(el).not.toHaveClass('dark');
      expect(el).not.toHaveClass('high-contrast');
      expect(el).toHaveAttribute('data-wave-theme', 'light');
    });

    it('lets a user className win over the provider defaults', () => {
      const { container } = render(
        <WaveProvider theme="dark" className="bg-transparent text-foreground/80 text-lg custom">
          Content
        </WaveProvider>,
      );
      const el = root(container);
      expect(el).toHaveClass('bg-transparent', 'text-lg', 'custom', 'wave-root', 'wave-dark');
      expect(el).not.toHaveClass('bg-background');
      expect(el).not.toHaveClass('text-body-1');
    });

    it('renders wave-light for a light provider nested inside a dark one', () => {
      render(
        <WaveProvider theme="dark" data-testid="outer">
          <WaveProvider theme="light" data-testid="inner">
            Preview
          </WaveProvider>
        </WaveProvider>,
      );
      const inner = screen.getByTestId('inner');
      expect(inner).toHaveClass('wave-root', 'wave-light', 'bg-background', 'text-foreground');
      expect(inner).not.toHaveClass('dark', 'wave-dark');
      expect(inner.parentElement).toBe(screen.getByTestId('outer'));
    });

    it('renders wave-dark for a dark provider nested inside a light one', () => {
      render(
        <WaveProvider data-testid="outer">
          <WaveProvider theme="dark" data-testid="inner">
            Panel
          </WaveProvider>
        </WaveProvider>,
      );
      expect(screen.getByTestId('outer')).toHaveClass('wave-light');
      expect(screen.getByTestId('inner')).toHaveClass('wave-dark', 'dark');
    });
  });

  describe('getThemeClassName', () => {
    it.each([
      ['light', 'wave-light'],
      ['dark', 'wave-dark dark'],
      ['high-contrast', 'wave-high-contrast high-contrast'],
    ] as const)('maps %s to "%s"', (theme, expected) => {
      expect(getThemeClassName(theme)).toBe(expected);
    });

    it('falls back to the light class for an unknown theme', () => {
      expect(getThemeClassName('neon' as WaveTheme)).toBe('wave-light');
    });
  });

  describe('dir (button-provider#28)', () => {
    it('sets dir="ltr" by default', () => {
      const { container } = render(<WaveProvider>Content</WaveProvider>);
      expect(root(container)).toHaveAttribute('dir', 'ltr');
    });

    it('sets dir="rtl" when specified', () => {
      const { container } = render(<WaveProvider dir="rtl">Content</WaveProvider>);
      expect(root(container)).toHaveAttribute('dir', 'rtl');
    });
  });

  describe('theme validation (button-provider#4)', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it.each(['light', 'dark', 'high-contrast'] as const)(
      'does not warn for the valid theme "%s" (StrictMode, rerenders)',
      (theme) => {
        const { rerender } = render(
          <React.StrictMode>
            <WaveProvider theme={theme}>Content</WaveProvider>
          </React.StrictMode>,
        );
        rerender(
          <React.StrictMode>
            <WaveProvider theme={theme}>Content 2</WaveProvider>
          </React.StrictMode>,
        );
        expect(warnSpy).not.toHaveBeenCalled();
      },
    );

    it('does not warn for the default theme', () => {
      render(<WaveProvider>Content</WaveProvider>);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns once for an unknown theme', () => {
      const { rerender } = render(
        <React.StrictMode>
          {/* @ts-expect-error intentionally passing an invalid theme */}
          <WaveProvider theme="neon">Content</WaveProvider>
        </React.StrictMode>,
      );
      rerender(
        <React.StrictMode>
          {/* @ts-expect-error intentionally passing an invalid theme */}
          <WaveProvider theme="neon">Content 2</WaveProvider>
        </React.StrictMode>,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown theme "neon"'));
    });

    it('does not treat Object.prototype keys as themes', () => {
      // @ts-expect-error intentionally passing an invalid theme
      render(<WaveProvider theme="toString">Content</WaveProvider>);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown theme "toString"'));
    });

    it("normalises an unknown theme to 'light' on the root and in the context value", () => {
      let value: WaveContextValue | undefined;
      function Capture() {
        value = useWaveTheme();
        return null;
      }
      const { container } = render(
        // @ts-expect-error intentionally passing an invalid theme
        <WaveProvider theme="neon">
          <Capture />
        </WaveProvider>,
      );
      const el = root(container);
      expect(el).toHaveAttribute('data-wave-theme', 'light');
      expect(el).toHaveClass('wave-light');
      expect(value).toMatchObject({ theme: 'light', themeClassName: 'wave-light' });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown theme "neon"'));
    });
  });
});

describe('useWaveTheme', () => {
  function ThemeConsumer() {
    const { theme, dir } = useWaveTheme();
    return <span data-testid="consumer">{`${theme}-${dir}`}</span>;
  }

  it('returns correct context values from provider', () => {
    render(
      <WaveProvider theme="dark" dir="rtl">
        <ThemeConsumer />
      </WaveProvider>,
    );
    expect(screen.getByTestId('consumer')).toHaveTextContent('dark-rtl');
  });

  it('exposes themeClassName, portalContainer and hasProvider', () => {
    const portalTarget = document.createElement('div');
    let value: WaveContextValue | undefined;
    function Capture() {
      value = useWaveTheme();
      return null;
    }
    render(
      <WaveProvider theme="high-contrast" portalContainer={portalTarget}>
        <Capture />
      </WaveProvider>,
    );
    expect(value).toEqual({
      theme: 'high-contrast',
      dir: 'ltr',
      themeClassName: 'wave-high-contrast high-contrast',
      portalContainer: portalTarget,
      hasProvider: true,
    });
  });

  it('returns defaults when no provider is present', () => {
    let value: WaveContextValue | undefined;
    function Capture() {
      value = useWaveTheme();
      return <ThemeConsumer />;
    }
    render(<Capture />);
    expect(screen.getByTestId('consumer')).toHaveTextContent('light-ltr');
    expect(value).toMatchObject({ hasProvider: false, portalContainer: null, themeClassName: '' });
  });

  it('memoises the context value (consumers do not re-render when the provider re-renders)', () => {
    let renders = 0;
    function Counter() {
      useWaveTheme();
      renders++;
      return null;
    }
    const child = <Counter />;
    const { rerender } = render(<WaveProvider theme="dark">{child}</WaveProvider>);
    rerender(<WaveProvider theme="dark">{child}</WaveProvider>);
    expect(renders).toBe(1);
    rerender(<WaveProvider theme="light">{child}</WaveProvider>);
    expect(renders).toBe(2);
  });

  it('exports the context value type (button-provider#27)', () => {
    expectTypeOf(useWaveTheme).returns.toEqualTypeOf<WaveContextValue>();
    expectTypeOf<WaveContextValue>().toEqualTypeOf<{
      theme: WaveTheme;
      dir: 'ltr' | 'rtl';
      themeClassName: string;
      portalContainer: HTMLElement | null;
      hasProvider: boolean;
    }>();
  });
});
