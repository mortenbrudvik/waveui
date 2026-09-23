import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import * as React from 'react';
import { useScrollLock } from '../useScrollLock';

function Lock({ enabled = true }: { enabled?: boolean }) {
  useScrollLock(enabled);
  return null;
}

function TwoLocks({ a, b }: { a: boolean; b: boolean }) {
  return (
    <>
      <Lock enabled={a} />
      <Lock enabled={b} />
    </>
  );
}

const html = document.documentElement;
const body = document.body;

let restoreCss: (() => void) | null = null;

/** Makes `CSS.supports('scrollbar-gutter', 'stable')` answer `supported` (jsdom has no `CSS`). */
function mockGutterSupport(supported: boolean) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'CSS');
  Object.defineProperty(globalThis, 'CSS', {
    configurable: true,
    writable: true,
    value: {
      supports: (property: string, value?: string) =>
        supported &&
        (value === undefined
          ? property.replace(/\s/g, '') === 'scrollbar-gutter:stable'
          : property === 'scrollbar-gutter' && value === 'stable'),
    },
  });
  restoreCss = () => {
    if (previous) Object.defineProperty(globalThis, 'CSS', previous);
    else Reflect.deleteProperty(globalThis, 'CSS');
  };
}

/** Simulates a classic 15px scrollbar: innerWidth 1024, documentElement.clientWidth 1009. */
function mockScrollbar(width: number) {
  Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 - width });
}

beforeEach(() => {
  html.removeAttribute('style');
  body.removeAttribute('style');
});

afterEach(() => {
  restoreCss?.();
  restoreCss = null;
  Reflect.deleteProperty(html, 'clientWidth');
  html.removeAttribute('style');
  body.removeAttribute('style');
});

describe('useScrollLock', () => {
  it('hides overflow on the document scroller while enabled and restores it afterwards', () => {
    html.style.overflow = 'scroll';
    const { rerender, unmount } = render(<Lock />);
    expect(html.style.overflow).toBe('hidden');
    rerender(<Lock enabled={false} />);
    expect(html.style.overflow).toBe('scroll');
    rerender(<Lock />);
    expect(html.style.overflow).toBe('hidden');
    unmount();
    expect(html.style.overflow).toBe('scroll');
  });

  it('does nothing while disabled', () => {
    render(<Lock enabled={false} />);
    expect(html.style.overflow).toBe('');
  });

  it('is ref-counted: stacked locks closed out of order restore only when the last one closes', () => {
    const { rerender } = render(<TwoLocks a b={false} />);
    rerender(<TwoLocks a b />);
    expect(html.style.overflow).toBe('hidden');
    // Close the first one while the second is still open.
    rerender(<TwoLocks a={false} b />);
    expect(html.style.overflow).toBe('hidden');
    rerender(<TwoLocks a={false} b={false} />);
    expect(html.style.overflow).toBe('');
  });

  it('restores when both locks close in the same commit', () => {
    html.style.overflow = 'auto';
    const { rerender } = render(<TwoLocks a b />);
    rerender(<TwoLocks a={false} b={false} />);
    expect(html.style.overflow).toBe('auto');
  });

  it('counts once per lock under StrictMode', () => {
    const { unmount } = render(
      <React.StrictMode>
        <Lock />
      </React.StrictMode>,
    );
    expect(html.style.overflow).toBe('hidden');
    unmount();
    expect(html.style.overflow).toBe('');
  });

  it('keeps the layout stable with scrollbar-gutter: stable when supported', () => {
    mockGutterSupport(true);
    mockScrollbar(15);
    const { unmount } = render(<Lock />);
    expect(html.style.getPropertyValue('scrollbar-gutter')).toBe('stable');
    expect(body.style.paddingInlineEnd).toBe('');
    unmount();
    expect(html.style.getPropertyValue('scrollbar-gutter')).toBe('');
  });

  it('otherwise compensates the scrollbar width with padding-inline-end on body (RTL-safe)', () => {
    mockGutterSupport(false);
    mockScrollbar(15);
    body.style.paddingInlineEnd = '4px';
    const { unmount } = render(<Lock />);
    expect(body.style.paddingInlineEnd).toBe('19px');
    expect(html.style.getPropertyValue('scrollbar-gutter')).toBe('');
    unmount();
    expect(body.style.paddingInlineEnd).toBe('4px');
  });

  it('adds no compensation when the page has no scrollbar', () => {
    mockGutterSupport(false);
    mockScrollbar(0);
    const { unmount } = render(<Lock />);
    expect(body.style.paddingInlineEnd).toBe('');
    unmount();
  });

  it('restores only the styles it changed (no scrollbar: padding and gutter are left alone)', () => {
    mockGutterSupport(false);
    mockScrollbar(0);
    const { unmount } = render(<Lock />);
    // Something else adjusts the document while the lock is held.
    body.style.paddingInlineEnd = '10px';
    html.style.setProperty('scrollbar-gutter', 'stable both-edges');
    unmount();
    expect(body.style.paddingInlineEnd).toBe('10px');
    expect(html.style.getPropertyValue('scrollbar-gutter')).toBe('stable both-edges');
    expect(html.style.overflow).toBe('');
  });

  it('leaves body padding alone when it compensated with scrollbar-gutter', () => {
    mockGutterSupport(true);
    mockScrollbar(15);
    const { unmount } = render(<Lock />);
    body.style.paddingInlineEnd = '10px';
    unmount();
    expect(body.style.paddingInlineEnd).toBe('10px');
    expect(html.style.getPropertyValue('scrollbar-gutter')).toBe('');
  });

  it('leaves scrollbar-gutter alone when it compensated with padding', () => {
    mockGutterSupport(false);
    mockScrollbar(15);
    const { unmount } = render(<Lock />);
    html.style.setProperty('scrollbar-gutter', 'stable');
    unmount();
    expect(html.style.getPropertyValue('scrollbar-gutter')).toBe('stable');
    expect(body.style.paddingInlineEnd).toBe('');
  });

  it('keeps one counter for every copy of the library (global registry)', () => {
    const key = Symbol.for('@mortenbrudvik/waveui/scrollLock');
    const { unmount } = render(<Lock />);
    const registry = (globalThis as Record<symbol, unknown>)[key] as { count: number };
    expect(registry.count).toBe(1);
    unmount();
    expect(registry.count).toBe(0);
  });
});
