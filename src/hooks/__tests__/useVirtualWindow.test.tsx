import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  useVirtualWindow,
  type UseVirtualWindowOptions,
  type VirtualWindow,
} from '../useVirtualWindow';
import { useMergedRefs } from '../useMergedRefs';
import type { VirtualEntry } from '../../lib/virtual';
import { installResizeObserverMock } from '../../test-utils';

const ITEM = 44;
const COUNT = 10_000;

/** The `clientHeight` every scroller reports (jsdom has no layout; 0 is its "not measured"). */
let viewportHeight = 440;
/** The `scrollHeight` every scroller reports; 0 is jsdom's "no layout". */
let contentHeight = 0;

/** Frames requested through the `requestAnimationFrame` stub, run by {@link runFrames}. */
const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
let requestFrame: MockInstance<typeof requestAnimationFrame>;
let cancelFrame: MockInstance<typeof cancelAnimationFrame>;

/** Runs the frames requested so far, inside `act`. */
function runFrames(): void {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  });
}

beforeEach(() => {
  viewportHeight = 440;
  contentHeight = 0;
  frames.clear();
  requestFrame = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return this.hasAttribute('data-scroller') ? viewportHeight : 0;
  });
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
    return this.hasAttribute('data-scroller') ? contentHeight : 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

interface HarnessProps extends UseVirtualWindowOptions {
  count: number;
  keep?: readonly number[];
  /** Renders no scroller while false (a popup that has not opened yet). */
  mounted?: boolean;
  onRender?: () => void;
  windowRef?: React.Ref<VirtualWindow>;
}

interface WindowedListProps {
  virtualWindow: VirtualWindow;
  count: number;
  keep?: readonly number[];
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Renders `virtualWindow.layout(count)`, items as `<div data-index>` and spacers as
 * `<div data-spacer>`, the way a component given a `virtualWindow` prop does: the window object is
 * used as is in render, its callback ref merged with the component's own (`npm run lint` checks
 * this file).
 */
function WindowedList({ virtualWindow, count, keep, ref }: WindowedListProps) {
  const scrollerRef = useMergedRefs(ref, virtualWindow.scrollRef);
  return (
    <div ref={scrollerRef} data-scroller="" data-testid="scroller">
      {virtualWindow
        .layout(count, { keep })
        .map((entry) =>
          entry.kind === 'item' ? (
            <div key={entry.index} data-index={entry.index} />
          ) : (
            <div key={entry.key} data-spacer={entry.key} style={{ height: entry.size }} />
          ),
        )}
    </div>
  );
}

/** Holds the window (`onRender` counts its renders) and passes it to a {@link WindowedList}. */
function Harness({ count, keep, mounted = true, onRender, windowRef, ...options }: HarnessProps) {
  const virtualWindow = useVirtualWindow(options);
  React.useImperativeHandle(windowRef, () => virtualWindow, [virtualWindow]);
  onRender?.();
  if (!mounted) return null;
  return <WindowedList virtualWindow={virtualWindow} count={count} keep={keep} />;
}

const scroller = () => screen.getByTestId('scroller');

function renderedIndexes(root: ParentNode = document): number[] {
  return Array.from(root.querySelectorAll('[data-index]'), (el) =>
    Number(el.getAttribute('data-index')),
  );
}

function renderedSpacers(root: ParentNode = document): [key: string, height: string][] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-spacer]'), (el) => [
    el.dataset.spacer ?? '',
    el.style.height,
  ]);
}

/** `[from, to)`. */
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

/** Sets the scroller's `scrollTop` and fires `scroll`, in `act` (the frame is not run). */
function scrollTo(top: number, element: HTMLElement = scroller()): void {
  act(() => {
    element.scrollTop = top;
    fireEvent.scroll(element);
  });
}

/** The current window object of a harness given `windowRef={ref}`. */
function current(ref: React.RefObject<VirtualWindow | null>): VirtualWindow {
  if (!ref.current) throw new Error('the harness has not rendered');
  return ref.current;
}

describe('useVirtualWindow', () => {
  describe('window', () => {
    it('renders the rows of the measured viewport plus the overscan, with a spacer after them', () => {
      render(<Harness itemSize={ITEM} count={COUNT} />);
      // 440 / 44 = 10 rows in view, 6 more below; none above the first row.
      expect(renderedIndexes()).toEqual(range(0, 16));
      expect(renderedSpacers()).toEqual([['spacer-end', `${(COUNT - 16) * ITEM}px`]]);
    });

    it('moves the window in an animation frame after scroll events, one frame per batch', () => {
      render(<Harness itemSize={ITEM} count={COUNT} />);
      const el = scroller();
      act(() => {
        el.scrollTop = 100 * ITEM;
        fireEvent.scroll(el);
        fireEvent.scroll(el);
        fireEvent.scroll(el);
      });
      expect(requestFrame).toHaveBeenCalledTimes(1);
      // Nothing moves before the frame.
      expect(renderedIndexes()).toEqual(range(0, 16));

      runFrames();
      expect(renderedIndexes()).toEqual(range(94, 116));
      expect(renderedSpacers()).toEqual([
        ['spacer-94', `${94 * ITEM}px`],
        ['spacer-end', `${(COUNT - 116) * ITEM}px`],
      ]);
    });

    it('re-renders once per row boundary, not per scroll event', () => {
      const onRender = vi.fn();
      render(<Harness itemSize={ITEM} count={COUNT} onRender={onRender} />);
      scrollTo(100 * ITEM);
      runFrames();
      const renders = onRender.mock.calls.length;

      for (const top of [100 * ITEM + 1, 100 * ITEM + 20, 100 * ITEM + 43]) {
        scrollTo(top);
        runFrames();
      }
      expect(onRender).toHaveBeenCalledTimes(renders);
      expect(renderedIndexes()).toEqual(range(94, 116));

      scrollTo(101 * ITEM);
      runFrames();
      expect(onRender).toHaveBeenCalledTimes(renders + 1);
      expect(renderedIndexes()).toEqual(range(95, 117));
    });

    it('keeps the window object while its state stays, and its functions for good', () => {
      const ref = React.createRef<VirtualWindow>();
      render(<Harness itemSize={ITEM} count={COUNT} windowRef={ref} />);
      const first = current(ref);
      expect(first.itemSize).toBe(ITEM);

      scrollTo(20);
      runFrames();
      expect(current(ref)).toBe(first);

      scrollTo(10 * ITEM);
      runFrames();
      const moved = current(ref);
      expect(moved).not.toBe(first);
      expect(moved.scrollRef).toBe(first.scrollRef);
      expect(moved.scrollToIndex).toBe(first.scrollToIndex);
    });

    it('widens the window when a ResizeObserver reports a taller viewport', () => {
      const ro = installResizeObserverMock();
      try {
        render(<Harness itemSize={ITEM} count={COUNT} />);
        expect(renderedIndexes()).toEqual(range(0, 16));

        viewportHeight = 880;
        ro.trigger(scroller());
        // 880 / 44 = 20 rows in view, plus 6.
        expect(renderedIndexes()).toEqual(range(0, 26));
      } finally {
        ro.restore();
      }
    });

    it('keeps the size measured on attach without a ResizeObserver, until the next scroll', () => {
      // `src/test-setup.ts` installs no ResizeObserver: the hook must not need one.
      expect(typeof globalThis.ResizeObserver).toBe('undefined');
      render(<Harness itemSize={ITEM} count={COUNT} />);
      viewportHeight = 880;
      expect(renderedIndexes()).toEqual(range(0, 16));

      scrollTo(0);
      runFrames();
      expect(renderedIndexes()).toEqual(range(0, 26));
    });

    it('uses initialViewportSize while the scroller measures 0 (no layout)', () => {
      viewportHeight = 0;
      const { rerender } = render(<Harness itemSize={ITEM} count={COUNT} />);
      // The default 480 px: ceil(480 / 44) = 11 rows, plus 6.
      expect(renderedIndexes()).toEqual(range(0, 17));

      rerender(<Harness itemSize={ITEM} count={COUNT} initialViewportSize={220} />);
      expect(renderedIndexes()).toEqual(range(0, 11));
    });

    it('applies a new itemSize and overscan on the next render', () => {
      const { rerender } = render(<Harness itemSize={ITEM} count={COUNT} />);
      scrollTo(100 * ITEM);
      runFrames();
      expect(renderedIndexes()).toEqual(range(94, 116));

      // The same 4400 px offset is row 200 of 22 px rows, and 440 px hold 20 of them; the default
      // overscan is 11 of them (240 px).
      rerender(<Harness itemSize={22} count={COUNT} />);
      expect(renderedIndexes()).toEqual(range(189, 231));
      expect(renderedSpacers()).toEqual([
        ['spacer-189', `${189 * 22}px`],
        ['spacer-end', `${(COUNT - 231) * 22}px`],
      ]);

      rerender(<Harness itemSize={22} overscan={2} count={COUNT} />);
      expect(renderedIndexes()).toEqual(range(198, 222));
    });

    it('treats a negative scroll offset (elastic overscroll) as the top', () => {
      render(<Harness itemSize={ITEM} count={COUNT} />);
      scrollTo(-30);
      runFrames();
      expect(renderedIndexes()).toEqual(range(0, 16));
    });
  });

  describe('default overscan', () => {
    it.each<[itemSize: number, inView: number, overscan: number]>([
      // ceil(240 / 28) = 9 rows beyond each edge: 252 px.
      [28, 16, 9],
      // ceil(240 / 32) = 8 rows: 256 px.
      [32, 14, 8],
      // 6 rows are 240 px and more from 40 px on.
      [40, 11, 6],
      [44, 10, 6],
      [80, 6, 6],
    ])(
      'covers at least 240 pixels beyond each edge, and at least 6 rows (itemSize %i)',
      (itemSize, inView, overscan) => {
        render(<Harness itemSize={itemSize} count={COUNT} />);
        expect(renderedIndexes()).toEqual(range(0, inView + overscan));

        scrollTo(1000 * itemSize);
        runFrames();
        expect(renderedIndexes()).toEqual(range(1000 - overscan, 1000 + inView + overscan));
      },
    );

    it('keeps an explicit overscan as a number of rows', () => {
      render(<Harness itemSize={28} overscan={2} count={COUNT} />);
      expect(renderedIndexes()).toEqual(range(0, 16 + 2));
    });
  });

  describe('keep', () => {
    it('keeps an index outside the window mounted, with a spacer on each side', () => {
      render(<Harness itemSize={ITEM} count={COUNT} keep={[5000]} />);
      expect(renderedIndexes()).toEqual([...range(0, 16), 5000]);
      expect(renderedSpacers()).toEqual([
        ['spacer-5000', `${(5000 - 16) * ITEM}px`],
        ['spacer-end', `${(COUNT - 5001) * ITEM}px`],
      ]);
    });

    it('keeps the kept index while the window scrolls past it', () => {
      render(<Harness itemSize={ITEM} count={COUNT} keep={[3]} />);
      scrollTo(1000 * ITEM);
      runFrames();
      expect(renderedIndexes()).toEqual([3, ...range(994, 1016)]);
      expect(renderedSpacers()).toEqual([
        ['spacer-3', `${3 * ITEM}px`],
        ['spacer-994', `${(994 - 4) * ITEM}px`],
        ['spacer-end', `${(COUNT - 1016) * ITEM}px`],
      ]);
    });
  });

  describe('count changes under a scrolled window', () => {
    /** Valid entries: unique, ascending integer indexes inside the list, no empty spacer. */
    function expectValid(count: number) {
      const indexes = renderedIndexes();
      for (const index of indexes) {
        expect(Number.isInteger(index)).toBe(true);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(count);
      }
      expect(indexes).toEqual([...new Set(indexes)].sort((a, b) => a - b));
      for (const [, height] of renderedSpacers()) expect(parseFloat(height)).toBeGreaterThan(0);
    }

    it('gives a valid window when the count shrinks below the scroll position, and grows back', () => {
      const { rerender } = render(<Harness itemSize={ITEM} count={COUNT} keep={[7000]} />);
      scrollTo(5000 * ITEM);
      runFrames();
      expect(renderedIndexes()).toEqual([...range(4994, 5016), 7000]);

      // A filter leaves 20 rows: the window ends at the last row (rows 10..19 in view).
      rerender(<Harness itemSize={ITEM} count={20} keep={[7000]} />);
      expect(renderedIndexes()).toEqual(range(4, 20));
      expect(renderedSpacers()).toEqual([['spacer-4', `${4 * ITEM}px`]]);
      expectValid(20);

      // A kept index at or past the new count, negative or not an integer is ignored.
      rerender(<Harness itemSize={ITEM} count={20} keep={[20, 7000, -1, 2.5, 0]} />);
      expect(renderedIndexes()).toEqual([0, ...range(4, 20)]);
      expectValid(20);

      rerender(<Harness itemSize={ITEM} count={1} />);
      expect(renderedIndexes()).toEqual([0]);
      expect(renderedSpacers()).toEqual([]);

      rerender(<Harness itemSize={ITEM} count={0} />);
      expect(renderedIndexes()).toEqual([]);
      expect(renderedSpacers()).toEqual([]);

      // The browser clamps the offset of the shorter content (20 rows: at most 880 - 440) and
      // fires a scroll; the list then grows again.
      rerender(<Harness itemSize={ITEM} count={20} />);
      scrollTo(20 * ITEM - viewportHeight);
      runFrames();
      expect(renderedIndexes()).toEqual(range(4, 20));
      rerender(<Harness itemSize={ITEM} count={COUNT} />);
      expect(renderedIndexes()).toEqual(range(4, 26));
      expectValid(COUNT);
    });

    it('renders every row of a list shorter than the viewport, with no spacer', () => {
      render(<Harness itemSize={ITEM} count={5} />);
      expect(renderedIndexes()).toEqual(range(0, 5));
      expect(renderedSpacers()).toEqual([]);
    });
  });

  describe('scrollToIndex', () => {
    it('sets scrollTop for each alignment and mounts the row in the same update', () => {
      const ref = React.createRef<VirtualWindow>();
      render(<Harness itemSize={ITEM} count={COUNT} windowRef={ref} />);

      act(() => current(ref).scrollToIndex(5000, { align: 'start' }));
      expect(scroller().scrollTop).toBe(5000 * ITEM);
      // No scroll event or frame is needed: a component can focus the row after this commit.
      expect(renderedIndexes()).toEqual(range(4994, 5016));

      // `auto` (the default) leaves a row that is in view where it is.
      act(() => current(ref).scrollToIndex(5003));
      expect(scroller().scrollTop).toBe(5000 * ITEM);
      // `auto` brings a row below the view up to the bottom edge.
      act(() => current(ref).scrollToIndex(5020));
      expect(scroller().scrollTop).toBe(5021 * ITEM - 440);

      act(() => current(ref).scrollToIndex(6000, { align: 'end' }));
      expect(scroller().scrollTop).toBe(6001 * ITEM - 440);

      act(() => current(ref).scrollToIndex(6000, { align: 'center' }));
      expect(scroller().scrollTop).toBe(6000 * ITEM + ITEM / 2 - 220);
      expect(renderedIndexes()).toEqual(range(5989, 6011));
    });

    it('bounds the offset by the rendered content', () => {
      contentHeight = COUNT * ITEM;
      const ref = React.createRef<VirtualWindow>();
      render(<Harness itemSize={ITEM} count={COUNT} windowRef={ref} />);

      act(() => current(ref).scrollToIndex(COUNT - 1, { align: 'start' }));
      expect(scroller().scrollTop).toBe(COUNT * ITEM - 440);
      expect(renderedIndexes()).toEqual(range(9984, COUNT));

      act(() => current(ref).scrollToIndex(-5, { align: 'start' }));
      expect(scroller().scrollTop).toBe(0);
      expect(renderedIndexes()).toEqual(range(0, 16));
    });

    it('applies a request made before the scroller mounts when it attaches (the last one wins)', () => {
      const ref = React.createRef<VirtualWindow>();
      const { rerender } = render(
        <Harness itemSize={ITEM} count={COUNT} mounted={false} windowRef={ref} />,
      );
      act(() => current(ref).scrollToIndex(100, { align: 'start' }));
      act(() => current(ref).scrollToIndex(5000, { align: 'start' }));

      rerender(<Harness itemSize={ITEM} count={COUNT} mounted windowRef={ref} />);
      expect(scroller().scrollTop).toBe(5000 * ITEM);
      expect(renderedIndexes()).toEqual(range(4994, 5016));
    });

    describe('a request made before the scroller attached, once the viewport settles', () => {
      /** The offset that centres row 5000 in a viewport of `height` pixels. */
      const centred = (height: number) => 5000 * ITEM + ITEM / 2 - height / 2;

      /** Renders without a scroller, asks for row 5000 centred, then mounts the scroller. */
      function attachCentred(ref: React.RefObject<VirtualWindow | null>) {
        const { rerender } = render(
          <Harness itemSize={ITEM} count={COUNT} mounted={false} windowRef={ref} />,
        );
        act(() => current(ref).scrollToIndex(5000, { align: 'center' }));
        rerender(<Harness itemSize={ITEM} count={COUNT} mounted windowRef={ref} />);
        expect(scroller().scrollTop).toBe(centred(440));
      }

      it('is applied once more, in the same update, when the viewport first changes height (a popup that positioning shrinks)', () => {
        const ro = installResizeObserverMock();
        try {
          const ref = React.createRef<VirtualWindow>();
          attachCentred(ref);
          // The observer's first report of the same height changes nothing.
          ro.trigger(scroller());
          expect(scroller().scrollTop).toBe(centred(440));

          viewportHeight = 100;
          ro.trigger(scroller());
          expect(scroller().scrollTop).toBe(centred(100));
          // 100 / 44: rows 4999 to 5001 in view, 6 more on each side; no frame was run.
          expect(renderedIndexes()).toEqual(range(4993, 5008));

          // Once: a later change of height leaves the offset as it is.
          viewportHeight = 300;
          ro.trigger(scroller());
          expect(scroller().scrollTop).toBe(centred(100));
        } finally {
          ro.restore();
        }
      });

      it('is not applied again once the scroller was scrolled', () => {
        const ro = installResizeObserverMock();
        try {
          const ref = React.createRef<VirtualWindow>();
          attachCentred(ref);
          scrollTo(centred(440) + 300);
          runFrames();
          viewportHeight = 100;
          ro.trigger(scroller());
          expect(scroller().scrollTop).toBe(centred(440) + 300);
        } finally {
          ro.restore();
        }
      });

      it('is not applied again after another request', () => {
        const ro = installResizeObserverMock();
        try {
          const ref = React.createRef<VirtualWindow>();
          attachCentred(ref);
          // Row 5003 is in view: the request moves nothing, but it is the latest.
          act(() => current(ref).scrollToIndex(5003));
          viewportHeight = 100;
          ro.trigger(scroller());
          expect(scroller().scrollTop).toBe(centred(440));
        } finally {
          ro.restore();
        }
      });

      it('leaves a request made while the scroller was attached alone', () => {
        const ro = installResizeObserverMock();
        try {
          const ref = React.createRef<VirtualWindow>();
          render(<Harness itemSize={ITEM} count={COUNT} windowRef={ref} />);
          act(() => current(ref).scrollToIndex(5000, { align: 'center' }));
          viewportHeight = 100;
          ro.trigger(scroller());
          expect(scroller().scrollTop).toBe(centred(440));
        } finally {
          ro.restore();
        }
      });

      it('is forgotten when its scroller detaches: attached again, the scroller only measures', () => {
        const ro = installResizeObserverMock();
        try {
          const ref = React.createRef<VirtualWindow>();
          /** One scroller element whose ref is the window's only while `attached`. */
          function Detachable({ attached }: { attached: boolean }) {
            const virtualWindow = useVirtualWindow({ itemSize: ITEM });
            React.useImperativeHandle(ref, () => virtualWindow, [virtualWindow]);
            const { scrollRef } = virtualWindow;
            return (
              <div ref={attached ? scrollRef : undefined} data-scroller="" data-testid="scroller" />
            );
          }
          const { rerender } = render(<Detachable attached={false} />);
          act(() => current(ref).scrollToIndex(5000, { align: 'center' }));
          rerender(<Detachable attached />);
          const element = scroller();
          expect(element.scrollTop).toBe(centred(440));

          rerender(<Detachable attached={false} />);
          rerender(<Detachable attached />);
          expect(scroller()).toBe(element);
          viewportHeight = 100;
          ro.trigger(element);
          expect(element.scrollTop).toBe(centred(440));
        } finally {
          ro.restore();
        }
      });

      it('is applied once more in StrictMode too', () => {
        const ro = installResizeObserverMock();
        try {
          const ref = React.createRef<VirtualWindow>();
          const { rerender } = render(
            <React.StrictMode>
              <Harness itemSize={ITEM} count={COUNT} mounted={false} windowRef={ref} />
            </React.StrictMode>,
          );
          act(() => current(ref).scrollToIndex(5000, { align: 'center' }));
          rerender(
            <React.StrictMode>
              <Harness itemSize={ITEM} count={COUNT} mounted windowRef={ref} />
            </React.StrictMode>,
          );
          viewportHeight = 100;
          ro.trigger(scroller());
          expect(scroller().scrollTop).toBe(centred(100));
        } finally {
          ro.restore();
        }
      });
    });

    it('detaches from a scroller that unmounts and remembers requests for the next one', () => {
      const ref = React.createRef<VirtualWindow>();
      const { rerender } = render(<Harness itemSize={ITEM} count={COUNT} windowRef={ref} />);
      const first = scroller();

      rerender(<Harness itemSize={ITEM} count={COUNT} mounted={false} windowRef={ref} />);
      requestFrame.mockClear();
      scrollTo(9000 * ITEM, first);
      expect(requestFrame).not.toHaveBeenCalled();
      expect(first.scrollTop).toBe(9000 * ITEM);

      act(() => current(ref).scrollToIndex(300, { align: 'start' }));
      rerender(<Harness itemSize={ITEM} count={COUNT} mounted windowRef={ref} />);
      const second = scroller();
      expect(second).not.toBe(first);
      expect(second.scrollTop).toBe(300 * ITEM);
      expect(renderedIndexes()).toEqual(range(294, 316));
    });
  });

  describe('scrollPaddingStart', () => {
    // A 44 px sticky header pinned at the top of a 440 px scroller leaves 396 px for the rows; the
    // rows keep their offsets.
    const HEADER = 44;
    const AREA = 440 - HEADER;

    it('shortens the visible area for end, center and auto, not for start or the layout', () => {
      const ref = React.createRef<VirtualWindow>();
      render(<Harness itemSize={ITEM} count={COUNT} scrollPaddingStart={HEADER} windowRef={ref} />);
      expect(renderedIndexes()).toEqual(range(0, 16));

      // Row 9 ends at 440 px, below the 396 px under the header: `auto` brings it up.
      act(() => current(ref).scrollToIndex(9));
      expect(scroller().scrollTop).toBe(10 * ITEM - AREA);

      act(() => current(ref).scrollToIndex(20, { align: 'end' }));
      expect(scroller().scrollTop).toBe(21 * ITEM - AREA);

      act(() => current(ref).scrollToIndex(20, { align: 'start' }));
      expect(scroller().scrollTop).toBe(20 * ITEM);

      act(() => current(ref).scrollToIndex(20, { align: 'center' }));
      expect(scroller().scrollTop).toBe(20 * ITEM + ITEM / 2 - AREA / 2);

      // From 704 px the rows 16..24 are whole under the header: `auto` leaves row 24 and brings
      // row 25 up to the bottom edge.
      act(() => current(ref).scrollToIndex(24));
      expect(scroller().scrollTop).toBe(704);
      act(() => current(ref).scrollToIndex(25));
      expect(scroller().scrollTop).toBe(26 * ITEM - AREA);
    });

    it('bounds the offset by the rows below the header', () => {
      // A header that is not a whole number of rows: 30 px above 10,000 rows of 44 px.
      contentHeight = 30 + COUNT * ITEM;
      const ref = React.createRef<VirtualWindow>();
      render(<Harness itemSize={ITEM} count={COUNT} scrollPaddingStart={30} windowRef={ref} />);
      act(() => current(ref).scrollToIndex(COUNT - 1, { align: 'start' }));
      // The browser's own bound: the content height less the viewport.
      expect(scroller().scrollTop).toBe(contentHeight - 440);
      expect(scroller().scrollTop).toBe(COUNT * ITEM - (440 - 30));
    });

    it('keeps one row of visible area under a header taller than the viewport', () => {
      const ref = React.createRef<VirtualWindow>();
      render(<Harness itemSize={ITEM} count={COUNT} scrollPaddingStart={1000} windowRef={ref} />);
      act(() => current(ref).scrollToIndex(20, { align: 'end' }));
      expect(scroller().scrollTop).toBe(20 * ITEM);
    });

    it.each([-10, Number.NaN, Number.POSITIVE_INFINITY])(
      'treats a padding of %s as 0',
      (padding) => {
        const ref = React.createRef<VirtualWindow>();
        render(
          <Harness itemSize={ITEM} count={COUNT} scrollPaddingStart={padding} windowRef={ref} />,
        );
        act(() => current(ref).scrollToIndex(20, { align: 'end' }));
        expect(scroller().scrollTop).toBe(21 * ITEM - 440);
      },
    );
  });

  describe('server and mount', () => {
    it('renders the first window of the default viewport on the server, reading no DOM', () => {
      const scrollTopRead = vi.spyOn(Element.prototype, 'scrollTop', 'get');
      const clientHeightRead = vi.mocked(
        Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight')?.get,
      );
      const scrollHeightRead = vi.mocked(
        Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight')?.get,
      );
      const html = renderToString(<Harness itemSize={ITEM} count={COUNT} />);

      const indexes = Array.from(html.matchAll(/data-index="(\d+)"/g), (match) => Number(match[1]));
      expect(indexes).toEqual(range(0, 17));
      expect(html).toContain(`data-spacer="spacer-end" style="height:${(COUNT - 17) * ITEM}px"`);
      expect(scrollTopRead).not.toHaveBeenCalled();
      expect(clientHeightRead).not.toHaveBeenCalled();
      expect(scrollHeightRead).not.toHaveBeenCalled();
      expect(requestFrame).not.toHaveBeenCalled();
    });

    it('hydrates the server window without a mismatch, then measures the scroller', () => {
      const html = renderToString(<Harness itemSize={ITEM} count={COUNT} />);
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      const consoleError = vi.spyOn(console, 'error');
      let root: Root | undefined;
      try {
        act(() => {
          root = hydrateRoot(container, <Harness itemSize={ITEM} count={COUNT} />);
        });
        expect(consoleError).not.toHaveBeenCalled();
        expect(renderedIndexes(container)).toEqual(range(0, 16));
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });

    it('attaches one passive scroll listener and one observer in StrictMode and releases them', () => {
      const ro = installResizeObserverMock();
      try {
        const add = vi.spyOn(EventTarget.prototype, 'addEventListener');
        const remove = vi.spyOn(EventTarget.prototype, 'removeEventListener');
        const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
        const disconnect = vi.spyOn(globalThis.ResizeObserver.prototype, 'disconnect');
        /** Calls of `spy` for a `scroll` listener on a scroller. */
        const scrollCalls = (spy: typeof add | typeof remove) =>
          spy.mock.calls.filter(
            ([type], i) =>
              type === 'scroll' &&
              (spy.mock.contexts[i] as Element | undefined)?.hasAttribute?.('data-scroller'),
          );

        const { unmount } = render(
          <React.StrictMode>
            <Harness itemSize={ITEM} count={COUNT} />
          </React.StrictMode>,
        );
        expect(scrollCalls(add).length - scrollCalls(remove).length).toBe(1);
        expect(scrollCalls(add).at(-1)?.[2]).toEqual({ passive: true });
        expect(observe.mock.calls.length - disconnect.mock.calls.length).toBe(1);
        expect(renderedIndexes()).toEqual(range(0, 16));

        scrollTo(100 * ITEM);
        expect(requestFrame).toHaveBeenCalledTimes(1);
        runFrames();
        expect(renderedIndexes()).toEqual(range(94, 116));

        unmount();
        expect(scrollCalls(remove).length).toBe(scrollCalls(add).length);
        expect(disconnect.mock.calls.length).toBe(observe.mock.calls.length);
      } finally {
        ro.restore();
      }
    });

    it('cancels a frame still pending at unmount, whose callback then reads and sets nothing', () => {
      const consoleError = vi.spyOn(console, 'error');
      const { unmount } = render(<Harness itemSize={ITEM} count={COUNT} />);
      scrollTo(100 * ITEM);
      expect(frames.size).toBe(1);
      const [[id, callback]] = [...frames];

      unmount();
      expect(cancelFrame).toHaveBeenCalledWith(id);
      expect(frames.size).toBe(0);

      // A frame the browser had already dispatched when the cleanup ran does nothing either.
      const scrollTopRead = vi.spyOn(Element.prototype, 'scrollTop', 'get');
      callback(performance.now());
      expect(scrollTopRead).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe('itemSize', () => {
    it('warns once when itemSize is not a positive finite number, and counts it as 1', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ref = React.createRef<VirtualWindow>();
      const { rerender } = render(<Harness itemSize={0} count={1000} windowRef={ref} />);
      // 440 rows of 1 px in view, plus the default overscan of 240 of them (240 px).
      expect(renderedIndexes()).toEqual(range(0, 680));
      expect(current(ref).itemSize).toBe(1);

      rerender(<Harness itemSize={Number.NaN} count={1000} windowRef={ref} />);
      rerender(<Harness itemSize={-4} count={1000} windowRef={ref} />);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[WaveUI] useVirtualWindow: itemSize must be a positive number of pixels (got 0); 1 is used.',
      );
    });
  });

  it('types its options and result', () => {
    expectTypeOf(useVirtualWindow).parameter(0).toEqualTypeOf<UseVirtualWindowOptions>();
    expectTypeOf(useVirtualWindow).returns.toEqualTypeOf<VirtualWindow>();
    expectTypeOf<UseVirtualWindowOptions['scrollPaddingStart']>().toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf<VirtualWindow['scrollRef']>().toEqualTypeOf<React.RefCallback<HTMLElement>>();
    expectTypeOf<ReturnType<VirtualWindow['layout']>>().toEqualTypeOf<readonly VirtualEntry[]>();
    const keep: readonly number[] = [1];
    expectTypeOf<VirtualWindow['layout']>().toBeCallableWith(10, { keep });
    expectTypeOf<VirtualWindow['scrollToIndex']>().toBeCallableWith(3, { align: 'center' });
    // @ts-expect-error the alignments are 'auto', 'start', 'center' and 'end'
    expectTypeOf<VirtualWindow['scrollToIndex']>().toBeCallableWith(3, { align: 'middle' });
    // @ts-expect-error itemSize is required
    expectTypeOf(useVirtualWindow).toBeCallableWith({ overscan: 2 });
  });
});
