import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { useApplyScrollbarWidth, useScrollbarWidth } from '../useScrollbarWidth';
import { measureScrollbarWidth } from '../../lib/scrollbar';

/** A layout: an element with `overflow: scroll` is 100 wide, its content narrower by the bar. */
function stubLayout(scrollbar: number) {
  return vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.style.overflow === 'scroll' ? 100 : 100 - scrollbar;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('measureScrollbarWidth (foundation-41)', () => {
  it('measures the difference between the scrolling box and its content, and cleans up', () => {
    stubLayout(15);
    const doc = document.implementation.createHTMLDocument('measure');
    const before = doc.body.childNodes.length;
    expect(measureScrollbarWidth(doc)).toBe(15);
    expect(doc.body.childNodes.length).toBe(before);
  });

  it('caches per document and measures again with force', () => {
    const spy = stubLayout(15);
    const doc = document.implementation.createHTMLDocument('cache');
    expect(measureScrollbarWidth(doc)).toBe(15);
    spy.mockClear();
    expect(measureScrollbarWidth(doc)).toBe(15);
    expect(spy).not.toHaveBeenCalled();
    stubLayout(0);
    expect(measureScrollbarWidth(doc)).toBe(15);
    expect(measureScrollbarWidth(doc, true)).toBe(0);
  });

  it('is 0 without layout (jsdom) and for a document without a body', () => {
    const doc = document.implementation.createHTMLDocument('none');
    expect(measureScrollbarWidth(doc)).toBe(0);
    const empty = document.implementation.createDocument(null, 'html');
    expect(measureScrollbarWidth(empty)).toBe(0);
  });
});

describe('useScrollbarWidth (foundation-41)', () => {
  it('returns the width of the document in the first client render', () => {
    stubLayout(12);
    const doc = document.implementation.createHTMLDocument('hook');
    const { result } = renderHook(() => useScrollbarWidth({ targetDocument: doc }));
    expect(result.current).toBe(12);
  });

  it('returns 0 for a null document and without layout', () => {
    const { result } = renderHook(() => useScrollbarWidth({ targetDocument: null }));
    expect(result.current).toBe(0);
    expect(renderHook(() => useScrollbarWidth()).result.current).toBe(0);
  });

  it('measures again when force changes', () => {
    stubLayout(10);
    const doc = document.implementation.createHTMLDocument('force');
    const { result, rerender } = renderHook(
      ({ force }: { force: boolean }) => useScrollbarWidth({ targetDocument: doc, force }),
      { initialProps: { force: false } },
    );
    expect(result.current).toBe(10);
    stubLayout(0);
    rerender({ force: true });
    expect(result.current).toBe(0);
  });

  it('renders 0 on the server and in the hydrating render, then the width, with no mismatch', async () => {
    stubLayout(9);
    const doc = document.implementation.createHTMLDocument('ssr');
    function Probe() {
      return <span>{useScrollbarWidth({ targetDocument: doc })}</span>;
    }
    expect(renderToString(<Probe />)).toContain('>0<');
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Probe />);
    document.body.appendChild(container);
    const errorSpy = vi.spyOn(console, 'error');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <Probe />);
      });
      expect(container.textContent).toBe('9');
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});

describe('useApplyScrollbarWidth (foundation-41)', () => {
  function Target(props: { property?: string; force?: boolean }) {
    const ref = useApplyScrollbarWidth<HTMLDivElement>(props);
    return <div ref={ref} data-testid="target" />;
  }

  it('writes the width to `width` by default and to the property asked for', () => {
    stubLayout(14);
    const { getByTestId, rerender } = render(<Target force />);
    expect(getByTestId('target').style.width).toBe('14px');
    rerender(<Target force property="--scrollbar-width" />);
    expect(getByTestId('target').style.getPropertyValue('--scrollbar-width')).toBe('14px');
  });

  it('keeps the identity of the ref while the options do', () => {
    const { result, rerender } = renderHook(() => useApplyScrollbarWidth());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('writes nothing for a detach', () => {
    const { result } = renderHook(() => useApplyScrollbarWidth());
    expect(() => result.current(null)).not.toThrow();
  });
});
