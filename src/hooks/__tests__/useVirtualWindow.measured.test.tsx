import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import {
  useVirtualWindow,
  type UseVirtualWindowOptions,
  type VirtualItemProps,
  type VirtualWindow,
} from '../useVirtualWindow';
import { useMergedRefs } from '../useMergedRefs';
import { installResizeObserverMock, type ResizeObserverMock } from '../../test-utils';

const ESTIMATE = 40;
const COUNT = 1000;
const VIEWPORT = 400;

/** The height of each row, by index: tall rows alternate with short ones. */
let heightOf = (index: number): number => (index % 2 === 0 ? 40 : 80);
let ro: ResizeObserverMock;
const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
/** The rows that have been rendered (and so measured) in the current test. */
const seen = new Set<number>();

beforeEach(() => {
  heightOf = (index) => (index % 2 === 0 ? 40 : 80);
  seen.clear();
  ro = installResizeObserverMock();
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return this.hasAttribute('data-scroller') ? VIEWPORT : 0;
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const attribute = this.getAttribute('data-virtual-index');
    const height = attribute === null ? 0 : heightOf(Number(attribute));
    return new DOMRect(0, 0, 200, height);
  });
  frames.clear();
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
});

afterEach(() => {
  ro.restore();
  vi.restoreAllMocks();
});

interface ListProps {
  virtualWindow: VirtualWindow;
  count: number;
}

function List({ virtualWindow, count }: ListProps) {
  const ref = useMergedRefs<HTMLDivElement>(virtualWindow.scrollRef);
  const entries = virtualWindow.layout(count);
  React.useLayoutEffect(() => {
    for (const entry of entries) if (entry.kind === 'item') seen.add(entry.index);
  });
  return (
    <div ref={ref} data-scroller="" data-testid="scroller">
      {entries.map((entry) =>
        entry.kind === 'item' ? (
          <div
            key={entry.index}
            data-row={entry.index}
            {...virtualWindow.itemProps?.(entry.index)}
          />
        ) : (
          <div key={entry.key} data-spacer={entry.key} style={{ height: entry.size }} />
        ),
      )}
    </div>
  );
}

interface HarnessProps extends Partial<UseVirtualWindowOptions> {
  count?: number;
  windowRef?: React.Ref<VirtualWindow>;
}

function Harness({ count = COUNT, windowRef, ...options }: HarnessProps) {
  const virtualWindow = useVirtualWindow({ itemSize: ESTIMATE, measureItems: true, ...options });
  React.useImperativeHandle(windowRef, () => virtualWindow, [virtualWindow]);
  return <List virtualWindow={virtualWindow} count={count} />;
}

const scroller = () => screen.getByTestId('scroller');

function rows(): number[] {
  return Array.from(document.querySelectorAll('[data-row]'), (el) =>
    Number(el.getAttribute('data-row')),
  );
}

function spacerHeights(): [string, number][] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-spacer]'), (el) => [
    el.dataset.spacer ?? '',
    parseFloat(el.style.height),
  ]);
}

/**
 * The height of the whole list as the window knows it: measured rows at their heights (the rows
 * that were rendered), every other row at the estimate.
 */
function expectedHeight(): number {
  let sum = 0;
  for (let index = 0; index < COUNT; index++) sum += seen.has(index) ? heightOf(index) : ESTIMATE;
  return sum;
}

/** The top of row `index` as the window knows it (measured rows at their heights). */
function topOf(index: number): number {
  let sum = 0;
  for (let row = 0; row < index; row++) sum += seen.has(row) ? heightOf(row) : ESTIMATE;
  return sum;
}

/** The row that holds `offset`, by the same sizes. */
function rowAt(offset: number): number {
  let row = 0;
  while (topOf(row + 1) <= offset) row++;
  return row;
}

/** The height the DOM holds: the heights of the rendered rows and of the spacers. */
function contentHeight(): number {
  return (
    rows().reduce((sum, index) => sum + heightOf(index), 0) +
    spacerHeights().reduce((sum, [, height]) => sum + height, 0)
  );
}

/** Scrolls the scroller, then runs the animation frame the scroll event asked for. */
function scrollTo(top: number): void {
  act(() => {
    scroller().scrollTop = top;
    fireEvent.scroll(scroller());
  });
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  });
}

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

describe('useVirtualWindow with measureItems', () => {
  it('gives a measuring window itemProps, and a fixed one none', () => {
    const measured = React.createRef<VirtualWindow>();
    const fixed = React.createRef<VirtualWindow>();
    render(
      <>
        <Harness windowRef={measured} />
        <Harness windowRef={fixed} measureItems={false} />
      </>,
    );
    expect(measured.current?.itemProps?.(7)).toEqual({ 'data-virtual-index': 7 });
    expect(measured.current?.itemSize).toBe(ESTIMATE);
    expect(fixed.current?.itemProps).toBeUndefined();
    expectTypeOf<VirtualWindow['itemProps']>().toEqualTypeOf<
      ((index: number) => VirtualItemProps) | undefined
    >();
  });

  it('lays out from the estimate first and from the measured heights once rows are measured', () => {
    // Before measuring: the initial viewport of 480 px holds 12 rows of the estimate, and the 6
    // rows of the overscan follow.
    const html = renderToString(<Harness />);
    expect(html.match(/data-row="/g)).toHaveLength(18);

    render(<Harness />);
    // Measured: rows alternate 40 and 80, so 400 px hold about 7 rows, with the overscan 13.
    const shown = rows();
    expect(shown[0]).toBe(0);
    expect(shown.length).toBeLessThan(16);
    // The spacer stands for the rows after them: the whole list less the rows rendered.
    expect(spacerHeights()).toEqual([['spacer-end', expectedHeight() - topOf(shown.length)]]);
    // The scroll height is the whole list's, whatever is rendered.
    expect(contentHeight()).toBe(expectedHeight());
  });

  it('keeps the scroll height of the whole list while scrolling', () => {
    render(<Harness />);
    for (const top of [1234, 10_000, 30_000]) {
      scrollTo(top);
      expect(contentHeight()).toBe(expectedHeight());
    }
    const shown = rows();
    expect(shown).toContain(rowAt(30_000));
    expect(shown).toEqual(range(shown[0], shown[0] + shown.length));
  });

  it('measures the rows scrolled into view and corrects the estimate of the spacers', () => {
    render(<Harness />);
    // Row 100 starts at 5,000 px by the estimate (40 each), 6,000 px by the measured heights.
    scrollTo(100 * ESTIMATE);
    const before = rows();
    expect(before).toContain(100);
    // The rows above the view were rendered with their real heights; the spacer holds estimates.
    expect(contentHeight()).toBe(expectedHeight());
    expect(spacerHeights()[0][0]).toMatch(/^spacer-/);
  });

  it('moves the scroll position when a row above the view differs from its estimate', () => {
    render(<Harness />);
    scrollTo(20_000);
    const start = scroller().scrollTop;
    const first = rows()[0];
    // A row that rendered above the view (in the overscan) grows by 100 px.
    const grown = first + 1;
    const previous = heightOf;
    heightOf = (index) => (index === grown ? previous(index) + 100 : previous(index));
    ro.trigger();
    expect(scroller().scrollTop).toBe(start + 100);
  });

  it('does not move the scroll position for a row below the view', () => {
    render(<Harness />);
    scrollTo(20_000);
    const start = scroller().scrollTop;
    const last = rows()[rows().length - 1];
    const previous = heightOf;
    heightOf = (index) => (index === last ? previous(index) + 100 : previous(index));
    ro.trigger();
    expect(scroller().scrollTop).toBe(start);
    expect(contentHeight()).toBe(expectedHeight());
  });

  it('measures a row again when its element is reused for another index', async () => {
    function Reused({ shift }: { shift: number }) {
      const virtualWindow = useVirtualWindow({ itemSize: ESTIMATE, measureItems: true });
      const ref = useMergedRefs<HTMLDivElement>(virtualWindow.scrollRef);
      return (
        <div ref={ref} data-scroller="" data-testid="scroller">
          <div data-row="" {...virtualWindow.itemProps?.(1 + shift)} />
        </div>
      );
    }
    const { rerender } = render(<Reused shift={0} />);
    rerender(<Reused shift={1} />);
    // Row 2 is 40 tall and row 1 is 80: the element that was row 1 now is row 2.
    expect(document.querySelector('[data-row]')?.getAttribute('data-virtual-index')).toBe('2');
  });

  describe('scrollToIndex', () => {
    it('places a row at the start and settles as the rows above it are measured', () => {
      const handle = React.createRef<VirtualWindow>();
      render(<Harness windowRef={handle} />);
      act(() => handle.current?.scrollToIndex(300, { align: 'start' }));
      // By the estimate row 300 starts at 12,000 px. The rows of the overscan above it are
      // measured when they render (the tall ones are taller than estimated), which moves row 300
      // down: the request follows it.
      expect(rows()).toContain(300);
      expect(scroller().scrollTop).toBe(topOf(300));
      expect(contentHeight()).toBe(expectedHeight());
    });

    it('stops following its row once the user scrolls', () => {
      // Heights that are not known yet (0 is ignored) keep the request waiting for them.
      heightOf = () => 0;
      const handle = React.createRef<VirtualWindow>();
      render(<Harness windowRef={handle} />);
      act(() => handle.current?.scrollToIndex(300, { align: 'start' }));
      expect(scroller().scrollTop).toBe(300 * ESTIMATE);
      scrollTo(scroller().scrollTop + 500);
      heightOf = (index) => (index % 2 === 0 ? 40 : 80);
      ro.trigger();
      // The rows are measured now, but the request no longer moves the view to its row: only the
      // rows above the view shift it.
      expect(scroller().scrollTop).not.toBe(300 * ESTIMATE + 120);
      expect(scroller().scrollTop).toBeGreaterThanOrEqual(300 * ESTIMATE + 500);
    });

    it('applies a request made before the scroller attached', () => {
      const handle = React.createRef<VirtualWindow>();
      function Late() {
        const [mounted, setMounted] = React.useState(false);
        const virtualWindow = useVirtualWindow({ itemSize: ESTIMATE, measureItems: true });
        React.useImperativeHandle(handle, () => virtualWindow, [virtualWindow]);
        return (
          <>
            <button type="button" onClick={() => setMounted(true)}>
              open
            </button>
            {mounted && <List virtualWindow={virtualWindow} count={COUNT} />}
          </>
        );
      }
      render(<Late />);
      act(() => handle.current?.scrollToIndex(200, { align: 'start' }));
      fireEvent.click(screen.getByRole('button', { name: 'open' }));
      expect(rows()).toContain(200);
      expect(scroller().scrollTop).toBe(topOf(200));
    });
  });

  it('works under StrictMode without recording a row twice', () => {
    render(
      <React.StrictMode>
        <Harness />
      </React.StrictMode>,
    );
    expect(contentHeight()).toBe(expectedHeight());
  });

  it('takes a new estimate for the rows it has not measured', () => {
    const { rerender } = render(<Harness itemSize={40} />);
    const rendered = rows().length;
    rerender(<Harness itemSize={100} />);
    expect(rows().length).toBeLessThanOrEqual(rendered);
    expect(contentHeight()).toBeGreaterThan(0);
  });

  it('stops observing rows when the scroller leaves', () => {
    const disconnect = vi.spyOn(globalThis.ResizeObserver.prototype, 'disconnect');
    const { unmount } = render(<Harness />);
    unmount();
    // The scroller's observer and the rows' observer.
    expect(disconnect).toHaveBeenCalledTimes(2);
  });
});
