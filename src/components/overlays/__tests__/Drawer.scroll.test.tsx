import { afterEach, describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { scrollSeparatorClasses, useScrollState, type DrawerScrollState } from '../Drawer.scroll';
import { installResizeObserverMock } from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

interface Metrics {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}

/** Gives `el` scroll metrics (jsdom has no layout: every measure is 0). */
function stubMetrics(el: HTMLElement, metrics: Partial<Metrics>) {
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(el, key, { configurable: true, value });
  }
}

/** A scroller that renders its own scroll state and reports each state it renders. */
function Scroller({
  children,
  onState,
}: {
  children?: React.ReactNode;
  onState?: (state: DrawerScrollState) => void;
}) {
  const [element, setElement] = React.useState<HTMLElement | null>(null);
  const state = useScrollState(element);
  React.useEffect(() => onState?.(state), [onState, state]);
  return (
    <div ref={setElement} data-testid="scroller" data-scroll-state={state}>
      {children}
    </div>
  );
}

const scroller = () => screen.getByTestId('scroller');

function scroll(el: HTMLElement, scrollTop: number) {
  stubMetrics(el, { scrollTop });
  act(() => {
    fireEvent.scroll(el);
  });
}

describe('useScrollState (P6-05 D80, D81)', () => {
  it("is 'none' for no element", () => {
    const { result } = renderHook(() => useScrollState(null));
    expect(result.current).toBe('none');
  });

  it("is 'none' on the server", () => {
    expect(renderToString(<Scroller>Content</Scroller>)).toContain('data-scroll-state="none"');
  });

  it("is 'none' while the content fits, also within the 1px tolerance", () => {
    render(<Scroller>Content</Scroller>);
    expect(scroller()).toHaveAttribute('data-scroll-state', 'none');
    stubMetrics(scroller(), { scrollHeight: 300.6, clientHeight: 300 });
    scroll(scroller(), 0);
    expect(scroller()).toHaveAttribute('data-scroll-state', 'none');
  });

  it('follows the scroll position: top, middle, bottom', () => {
    render(<Scroller>Content</Scroller>);
    const el = scroller();
    stubMetrics(el, { scrollHeight: 1000, clientHeight: 300 });
    scroll(el, 0);
    expect(el).toHaveAttribute('data-scroll-state', 'top');
    scroll(el, 0.5);
    expect(el).toHaveAttribute('data-scroll-state', 'top');
    scroll(el, 350);
    expect(el).toHaveAttribute('data-scroll-state', 'middle');
    scroll(el, 700);
    expect(el).toHaveAttribute('data-scroll-state', 'bottom');
    // A fractional offset that leaves the end 0.4px away counts as the end.
    scroll(el, 699.6);
    expect(el).toHaveAttribute('data-scroll-state', 'bottom');
    scroll(el, 698);
    expect(el).toHaveAttribute('data-scroll-state', 'middle');
  });

  it('measures again when the content changes (MutationObserver)', async () => {
    const { rerender } = render(<Scroller>Short</Scroller>);
    const el = scroller();
    expect(el).toHaveAttribute('data-scroll-state', 'none');
    // The content grows past the box without a scroll.
    stubMetrics(el, { scrollHeight: 900, clientHeight: 300, scrollTop: 0 });
    rerender(
      <Scroller>
        <p>Short</p>
        <p>Longer content</p>
      </Scroller>,
    );
    await act(async () => {});
    expect(el).toHaveAttribute('data-scroll-state', 'top');
  });

  it("measures again when a child's size changes (ResizeObserver)", () => {
    const resizeObserver = installResizeObserverMock();
    try {
      render(
        <Scroller>
          <div data-testid="child">Content</div>
        </Scroller>,
      );
      const el = scroller();
      expect(el).toHaveAttribute('data-scroll-state', 'none');
      stubMetrics(el, { scrollHeight: 900, clientHeight: 300, scrollTop: 0 });
      resizeObserver.trigger(screen.getByTestId('child'));
      expect(el).toHaveAttribute('data-scroll-state', 'top');
    } finally {
      resizeObserver.restore();
    }
  });

  it('measures on scroll without a ResizeObserver', () => {
    expect(typeof ResizeObserver).toBe('undefined');
    render(<Scroller>Content</Scroller>);
    stubMetrics(scroller(), { scrollHeight: 900, clientHeight: 300 });
    scroll(scroller(), 600);
    expect(scroller()).toHaveAttribute('data-scroll-state', 'bottom');
  });

  it('reports each change once, also under StrictMode', () => {
    const onState = vi.fn();
    render(
      <React.StrictMode>
        <Scroller onState={onState}>Content</Scroller>
      </React.StrictMode>,
    );
    onState.mockClear();
    stubMetrics(scroller(), { scrollHeight: 900, clientHeight: 300 });
    scroll(scroller(), 0);
    scroll(scroller(), 0);
    scroll(scroller(), 300);
    expect(onState.mock.calls).toEqual([['top'], ['middle']]);
  });

  it('adds no document listener', () => {
    const add = vi.spyOn(document, 'addEventListener');
    render(<Scroller>Content</Scroller>);
    stubMetrics(scroller(), { scrollHeight: 900, clientHeight: 300 });
    scroll(scroller(), 300);
    expect(add).not.toHaveBeenCalled();
  });

  it('stops listening when the element goes', () => {
    const { unmount } = render(<Scroller>Content</Scroller>);
    const el = scroller();
    const remove = vi.spyOn(el, 'removeEventListener');
    unmount();
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});

describe('scrollSeparatorClasses (P6-05 D80, D81)', () => {
  it('holds the header separator: a line under it once the body is scrolled', () => {
    expect(scrollSeparatorClasses.header.split(' ')).toEqual([
      'border-b',
      'border-transparent',
      'data-[scroll-state=middle]:border-border',
      'data-[scroll-state=bottom]:border-border',
      'forced-colors:border-[CanvasText]',
    ]);
  });

  it('holds the footer separator: a line above it while content continues below', () => {
    expect(scrollSeparatorClasses.footer.split(' ')).toEqual([
      'border-t',
      'border-transparent',
      'data-[scroll-state=top]:border-border',
      'data-[scroll-state=middle]:border-border',
      'forced-colors:border-[CanvasText]',
    ]);
  });
});
