import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { Drawer } from '../Drawer';
import { scrollSeparatorClasses, useScrollState, type DrawerScrollState } from '../Drawer.scroll';
import { Button } from '../../button/Button';
import {
  drawerClassNames,
  drawerFooterClassNames,
  drawerHeaderClassNames,
} from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';
import { installResizeObserverMock } from '../../../test-utils';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  expect(getTopmostLayer()).toBeNull();
  expect(document.querySelectorAll('[inert]')).toHaveLength(0);
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

describe('the scroll store’s contract (D108, frozen)', () => {
  it('types useScrollState, DrawerScrollState and scrollSeparatorClasses as the contract does', () => {
    expectTypeOf<DrawerScrollState>().toEqualTypeOf<'none' | 'top' | 'middle' | 'bottom'>();
    expectTypeOf(useScrollState).toEqualTypeOf<
      (element: HTMLElement | null) => DrawerScrollState
    >();
    expectTypeOf(scrollSeparatorClasses).toEqualTypeOf<{
      readonly header: string;
      readonly footer: string;
    }>();
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

// ---------------------------------------------------------------------------
// The scroll state of a Drawer (P6-05 D80, D81, D82)
// ---------------------------------------------------------------------------

/** A Drawer whose body, header area and footer render the scroll state. */
function renderDrawer(options: { composed?: boolean; content?: React.ReactNode } = {}) {
  const { composed = false, content = <p>Fields</p> } = options;
  return render(
    <Drawer defaultOpen title={composed ? undefined : 'Filters'}>
      {composed && (
        <Drawer.Header data-testid="header">
          <Drawer.HeaderTitle>Filters</Drawer.HeaderTitle>
        </Drawer.Header>
      )}
      {content}
      <Drawer.Footer data-testid="footer">
        <Button>Apply</Button>
      </Drawer.Footer>
    </Drawer>,
  );
}

function panel() {
  return screen.getByRole('dialog', { name: 'Filters' });
}

function body() {
  const element = panel().querySelector<HTMLElement>(`.${drawerClassNames.body}`);
  if (!element) throw new Error('no drawer body');
  return element;
}

/** The body, the header area and the footer: the elements that render the scroll state. */
function stateElements(): HTMLElement[] {
  const header = panel().firstElementChild as HTMLElement;
  return [body(), header, screen.getByTestId('footer')];
}

function expectState(state: DrawerScrollState) {
  for (const element of stateElements()) {
    expect(element).toHaveAttribute('data-scroll-state', state);
  }
}

describe('Drawer scroll state (P6-05 D80, D81)', () => {
  it("is 'none' on the body, the built-in header and the footer while the content fits", () => {
    renderDrawer();
    expect(panel().firstElementChild).toHaveClass(drawerClassNames.header);
    expectState('none');
  });

  it('follows the body: top, middle, bottom, with the 1px tolerance at the end', () => {
    renderDrawer();
    stubMetrics(body(), { scrollHeight: 1000, clientHeight: 300 });
    scroll(body(), 0);
    expectState('top');
    scroll(body(), 350);
    expectState('middle');
    scroll(body(), 700);
    expectState('bottom');
    scroll(body(), 350);
    expectState('middle');
    // scrollTop + clientHeight = scrollHeight - 0.4
    scroll(body(), 699.6);
    expectState('bottom');
  });

  it('mirrors the state on a placed Drawer.Header', () => {
    renderDrawer({ composed: true });
    expect(screen.getByTestId('header')).toHaveClass(drawerHeaderClassNames.root);
    stubMetrics(body(), { scrollHeight: 1000, clientHeight: 300 });
    scroll(body(), 350);
    expectState('middle');
  });

  it('measures again when the content grows (MutationObserver)', async () => {
    function Growing({ long }: { long: boolean }) {
      return (
        <Drawer defaultOpen title="Filters">
          <p>Fields</p>
          {long && <p>More fields</p>}
          <Drawer.Footer data-testid="footer">
            <Button>Apply</Button>
          </Drawer.Footer>
        </Drawer>
      );
    }
    const { rerender } = render(<Growing long={false} />);
    expectState('none');
    stubMetrics(body(), { scrollHeight: 900, clientHeight: 300, scrollTop: 0 });
    rerender(<Growing long />);
    await act(async () => {});
    expectState('top');
  });

  it("measures again when a child's size changes (ResizeObserver)", () => {
    const resizeObserver = installResizeObserverMock();
    try {
      renderDrawer({ content: <div data-testid="child">Fields</div> });
      expectState('none');
      stubMetrics(body(), { scrollHeight: 900, clientHeight: 300, scrollTop: 0 });
      resizeObserver.trigger(screen.getByTestId('child'));
      expectState('top');
    } finally {
      resizeObserver.restore();
    }
  });

  it('measures on scroll without a ResizeObserver', () => {
    expect(typeof ResizeObserver).toBe('undefined');
    renderDrawer();
    stubMetrics(body(), { scrollHeight: 900, clientHeight: 300 });
    scroll(body(), 600);
    expectState('bottom');
  });

  it('works under StrictMode', () => {
    render(
      <React.StrictMode>
        <Drawer defaultOpen title="Filters">
          <p>Fields</p>
          <Drawer.Footer data-testid="footer">
            <Button>Apply</Button>
          </Drawer.Footer>
        </Drawer>
      </React.StrictMode>,
    );
    expectState('none');
    stubMetrics(body(), { scrollHeight: 900, clientHeight: 300 });
    scroll(body(), 300);
    expectState('middle');
  });

  it("does not re-render the consumer's content when the state changes", () => {
    // The Profiler reports every commit in which the content rendered.
    const onRender = vi.fn();
    renderDrawer({
      content: (
        <React.Profiler id="content" onRender={onRender}>
          <p>Fields</p>
        </React.Profiler>
      ),
    });
    // The mount renders it (the root renders again once its panel element attaches, as in 0.10).
    const initial = onRender.mock.calls.length;
    expect(initial).toBeGreaterThan(0);
    stubMetrics(body(), { scrollHeight: 900, clientHeight: 300 });
    scroll(body(), 0);
    scroll(body(), 300);
    scroll(body(), 600);
    expectState('bottom');
    expect(onRender).toHaveBeenCalledTimes(initial);
  });

  it('draws the separators with the classes of scrollSeparatorClasses', () => {
    const header = scrollSeparatorClasses.header.split(' ');
    const footer = scrollSeparatorClasses.footer.split(' ');
    const { unmount } = renderDrawer();
    expect(panel().firstElementChild).toHaveClass(drawerClassNames.header, ...header);
    expect(screen.getByTestId('footer')).toHaveClass(drawerFooterClassNames.root, ...footer);
    // The built-in header's 0.10 line becomes the scroll-reactive separator (D82).
    expect(panel().firstElementChild).not.toHaveClass('border-border');
    unmount();

    renderDrawer({ composed: true });
    expect(screen.getByTestId('header')).toHaveClass(drawerHeaderClassNames.root, ...header);
    expect(body().className).not.toMatch(/scroll-state/);
  });

  it('adds no document listener while it opens and scrolls', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const { unmount } = renderDrawer();
    stubMetrics(body(), { scrollHeight: 900, clientHeight: 300 });
    const before = add.mock.calls.length;
    scroll(body(), 300);
    scroll(body(), 600);
    expect(add.mock.calls.slice(before)).toEqual([]);
    unmount();
    // Opening registers the modal layer's own listeners (0.10); the scroll store adds none.
    expect(add.mock.calls.map(([type]) => type)).not.toContain('scroll');
  });
});
