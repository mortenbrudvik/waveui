import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import {
  useActiveDescendant,
  type UseActiveDescendantOptions,
  type UseActiveDescendantResult,
} from '../useActiveDescendant';

/**
 * Renders one `useActiveDescendant` call over `items`, mounting an element only for the values of
 * `mounted` (a windowed list renders part of its items), and exposes the result through
 * `resultRef`, as `useActiveDescendant.test.tsx`'s `Probe` does.
 */
interface WindowProbeProps extends Omit<UseActiveDescendantOptions, 'getId'> {
  mounted: readonly string[];
  resultRef: React.RefObject<UseActiveDescendantResult | null>;
}

function WindowProbe({ mounted, resultRef, ...options }: WindowProbeProps) {
  const result = useActiveDescendant({ getId: (v) => `opt-${v}`, ...options });
  React.useImperativeHandle(resultRef, () => result);
  return (
    <ul aria-activedescendant={result.activeDescendantId}>
      {mounted.map((v) => (
        <li key={v} id={`opt-${v}`}>
          {v}
        </li>
      ))}
    </ul>
  );
}

const ITEMS = ['a', 'b', 'c', 'd', 'e'] as const;

/** Replaces `Element.prototype.scrollIntoView` with a spy for the duration of `run`. */
function withScrollSpy(run: (spy: ReturnType<typeof vi.fn>) => void) {
  const spy = vi.fn();
  const original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = spy;
  try {
    run(spy);
  } finally {
    Element.prototype.scrollIntoView = original;
  }
}

describe('useActiveDescendant onScrollToItem', () => {
  it('is called with the index in `items` instead of scrolling an item that is not mounted', () => {
    withScrollSpy((scrollIntoView) => {
      const onScrollToItem = vi.fn();
      const ref = React.createRef<UseActiveDescendantResult>();
      render(
        <WindowProbe
          items={ITEMS}
          mounted={['a', 'b']}
          onScrollToItem={onScrollToItem}
          resultRef={ref}
        />,
      );
      act(() => ref.current!.setActiveValue('d'));
      expect(onScrollToItem).toHaveBeenCalledTimes(1);
      expect(onScrollToItem).toHaveBeenCalledWith(3);
      expect(scrollIntoView).not.toHaveBeenCalled();
      // The active descendant points at the item before it mounts.
      expect(ref.current!.activeDescendantId).toBe('opt-d');

      // A mounted item is passed on too (a window moves to it), then scrolled into view as before.
      act(() => ref.current!.setActiveValue('b'));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
      expect(onScrollToItem.mock.calls).toEqual([[3], [1]]);
    });
  });

  it('is called before a mounted element is scrolled into view', () => {
    const calls: string[] = [];
    const target = document.createElement('div');
    target.scrollIntoView = () => calls.push('scrollIntoView');
    const ref = React.createRef<UseActiveDescendantResult>();
    render(
      <WindowProbe
        items={ITEMS}
        mounted={[]}
        getElement={(value) => (value === 'c' ? target : null)}
        onScrollToItem={(index) => calls.push(`onScrollToItem ${index}`)}
        resultRef={ref}
      />,
    );
    act(() => ref.current!.setActiveValue('c'));
    expect(calls).toEqual(['onScrollToItem 2', 'scrollIntoView']);
  });

  it('follows the moves of the keys: last, prev and move', () => {
    const onScrollToItem = vi.fn();
    const ref = React.createRef<UseActiveDescendantResult>();
    render(
      <WindowProbe items={ITEMS} mounted={[]} onScrollToItem={onScrollToItem} resultRef={ref} />,
    );
    act(() => ref.current!.last());
    act(() => ref.current!.prev());
    act(() => ref.current!.move(-10));
    expect(onScrollToItem.mock.calls).toEqual([[4], [3], [0]]);
  });

  it('is called for the fallback that becomes active on enabling', () => {
    const onScrollToItem = vi.fn();
    const ref = React.createRef<UseActiveDescendantResult>();
    const { rerender } = render(
      <WindowProbe
        items={ITEMS}
        mounted={['a']}
        fallback="e"
        enabled={false}
        onScrollToItem={onScrollToItem}
        resultRef={ref}
      />,
    );
    expect(onScrollToItem).not.toHaveBeenCalled();
    rerender(
      <WindowProbe
        items={ITEMS}
        mounted={['a']}
        fallback="e"
        onScrollToItem={onScrollToItem}
        resultRef={ref}
      />,
    );
    expect(onScrollToItem).toHaveBeenCalledTimes(1);
    expect(onScrollToItem).toHaveBeenCalledWith(4);
  });

  it('is not called for pointer moves or a scroll: false move', () => {
    const onScrollToItem = vi.fn();
    const ref = React.createRef<UseActiveDescendantResult>();
    render(
      <WindowProbe items={ITEMS} mounted={[]} onScrollToItem={onScrollToItem} resultRef={ref} />,
    );
    act(() => ref.current!.highlight('c'));
    act(() => ref.current!.setActiveValue('d', { scroll: false }));
    expect(ref.current!.activeValue).toBe('d');
    expect(onScrollToItem).not.toHaveBeenCalled();
  });

  it('scrolls a mounted element found by getElement into view as well', () => {
    const target = document.createElement('div');
    target.scrollIntoView = vi.fn();
    const onScrollToItem = vi.fn();
    const ref = React.createRef<UseActiveDescendantResult>();
    render(
      <WindowProbe
        items={ITEMS}
        mounted={[]}
        getElement={(value) => (value === 'c' ? target : null)}
        onScrollToItem={onScrollToItem}
        resultRef={ref}
      />,
    );
    act(() => ref.current!.setActiveValue('c'));
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    expect(onScrollToItem.mock.calls).toEqual([[2]]);
  });

  it('reports each move once in StrictMode', () => {
    const onScrollToItem = vi.fn();
    const ref = React.createRef<UseActiveDescendantResult>();
    render(
      <React.StrictMode>
        <WindowProbe items={ITEMS} mounted={[]} onScrollToItem={onScrollToItem} resultRef={ref} />
      </React.StrictMode>,
    );
    act(() => ref.current!.setActiveValue('e'));
    expect(onScrollToItem).toHaveBeenCalledTimes(1);
    expect(onScrollToItem).toHaveBeenCalledWith(4);
  });
});
