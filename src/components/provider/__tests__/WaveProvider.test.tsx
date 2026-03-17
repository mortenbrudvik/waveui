import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { WaveProvider, useWaveTheme } from '../WaveProvider';
import { testSystemProps } from '../../../test-utils';

describe('WaveProvider', () => {
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

  it('applies dark CSS class for theme="dark"', () => {
    const { container } = render(<WaveProvider theme="dark">Content</WaveProvider>);
    expect(container.firstElementChild).toHaveClass('dark');
  });

  it('applies high-contrast CSS class for theme="high-contrast"', () => {
    const { container } = render(<WaveProvider theme="high-contrast">Content</WaveProvider>);
    expect(container.firstElementChild).toHaveClass('high-contrast');
  });

  it('applies no theme class for light theme (default)', () => {
    const { container } = render(<WaveProvider>Content</WaveProvider>);
    const el = container.firstElementChild!;
    expect(el).not.toHaveClass('dark');
    expect(el).not.toHaveClass('high-contrast');
  });

  it('sets dir="ltr" by default', () => {
    const { container } = render(<WaveProvider>Content</WaveProvider>);
    expect(container.firstElementChild).toHaveAttribute('dir', 'ltr');
  });

  it('sets dir="rtl" when specified', () => {
    const { container } = render(<WaveProvider dir="rtl">Content</WaveProvider>);
    expect(container.firstElementChild).toHaveAttribute('dir', 'rtl');
  });

  it('warns on invalid theme in development', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-expect-error intentionally passing invalid theme
    render(<WaveProvider theme="neon">Content</WaveProvider>);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown theme "neon"'),
    );
    warnSpy.mockRestore();
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

  it('returns defaults when no provider is present', () => {
    render(<ThemeConsumer />);
    expect(screen.getByTestId('consumer')).toHaveTextContent('light-ltr');
  });
});
