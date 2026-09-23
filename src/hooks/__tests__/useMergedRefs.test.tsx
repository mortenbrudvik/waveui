import { describe, it, expect, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { useMergedRefs } from '../useMergedRefs';
import { mergeRefs } from '../../lib/mergeRefs';

function Box({
  refs,
  label = 'box',
}: {
  refs: Array<React.Ref<HTMLDivElement> | undefined>;
  label?: string;
}) {
  const merged = useMergedRefs(...refs);
  return <div ref={merged}>{label}</div>;
}

/**
 * Merges its `ref` prop with an inline callback ref created during its own render (a new function
 * on every render) and re-renders through its own state.
 */
function InlineMerge({
  ref,
  onNode,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  onNode: (node: HTMLButtonElement | null) => void;
}) {
  const [count, setCount] = React.useState(0);
  const merged = useMergedRefs(ref, (node: HTMLButtonElement | null) => {
    onNode(node);
  });
  return (
    <button type="button" ref={merged} onClick={() => setCount((c) => c + 1)}>
      {`clicked ${count}`}
    </button>
  );
}

/** Same, but the unstable ref is a fresh `mergeRefs(...)` result on every render. */
function FreshMergeRefs({
  first,
  second,
}: {
  first: React.Ref<HTMLButtonElement>;
  second: React.Ref<HTMLButtonElement>;
}) {
  const [count, setCount] = React.useState(0);
  const merged = useMergedRefs(mergeRefs(first, second));
  return (
    <button type="button" ref={merged} onClick={() => setCount((c) => c + 1)}>
      {`clicked ${count}`}
    </button>
  );
}

describe('useMergedRefs', () => {
  it('passes the node to object and callback refs', () => {
    const objectRef = React.createRef<HTMLDivElement>();
    const callbackRef = vi.fn();
    const { getByText } = render(<Box refs={[objectRef, callbackRef]} />);
    const node = getByText('box');
    expect(objectRef.current).toBe(node);
    expect(callbackRef).toHaveBeenCalledWith(node);
  });

  it('ignores null and undefined refs', () => {
    const objectRef = React.createRef<HTMLDivElement>();
    const { getByText } = render(<Box refs={[undefined, objectRef]} />);
    expect(objectRef.current).toBe(getByText('box'));
  });

  it('attaches the node once across rerenders while the refs are stable', () => {
    const callbackRef = vi.fn();
    const { rerender } = render(<Box refs={[callbackRef]} label="a" />);
    rerender(<Box refs={[callbackRef]} label="b" />);
    rerender(<Box refs={[callbackRef]} label="c" />);
    expect(callbackRef).toHaveBeenCalledTimes(1);
  });

  it('returns a callback ref whose identity never changes, also when a ref changes', () => {
    const a = React.createRef<HTMLDivElement>();
    const b = React.createRef<HTMLDivElement>();
    const c = React.createRef<HTMLDivElement>();
    const { result, rerender } = renderHook(
      ({ refs }: { refs: Array<React.Ref<HTMLDivElement>> }) => useMergedRefs(...refs),
      { initialProps: { refs: [a, b] } },
    );
    const first = result.current;
    rerender({ refs: [a, b] });
    expect(result.current).toBe(first);
    rerender({ refs: [a, c] });
    expect(result.current).toBe(first);
  });

  it('detaches the old refs and attaches the new ones when a ref changes', () => {
    const first = vi.fn();
    const second = React.createRef<HTMLDivElement>();
    const { rerender, getByText } = render(<Box refs={[first]} />);
    rerender(<Box refs={[second]} />);
    expect(first).toHaveBeenLastCalledWith(null);
    expect(second.current).toBe(getByText('box'));
  });

  it('keeps a stable ref attached while another ref in the list changes', () => {
    const stable = vi.fn();
    const initial = vi.fn<(node: HTMLDivElement | null) => void>();
    const { rerender, getByText } = render(<Box refs={[stable, initial]} />);
    const replacement = vi.fn();
    rerender(<Box refs={[stable, replacement]} />);
    expect(stable).toHaveBeenCalledTimes(1);
    expect(initial).toHaveBeenLastCalledWith(null);
    expect(replacement).toHaveBeenCalledWith(getByText('box'));
  });

  it('runs the React 19 cleanup of a callback ref that leaves the list', () => {
    const cleanup = vi.fn();
    const withCleanup = vi.fn(() => cleanup);
    const { rerender } = render(<Box refs={[withCleanup]} />);
    rerender(<Box refs={[undefined]} />);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(withCleanup).toHaveBeenCalledTimes(1);
  });

  it('resets object refs and runs React 19 callback-ref cleanups on unmount', () => {
    const objectRef = React.createRef<HTMLDivElement>();
    const cleanup = vi.fn();
    const callbackRef = vi.fn(() => cleanup);
    const { unmount } = render(<Box refs={[objectRef, callbackRef]} />);
    unmount();
    expect(objectRef.current).toBeNull();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(callbackRef).toHaveBeenCalledTimes(1);
  });

  it('gives the refs the new node when the element is replaced', () => {
    function Swap({ refs, tag }: { refs: Array<React.Ref<HTMLElement>>; tag: 'div' | 'section' }) {
      const merged = useMergedRefs(...refs);
      return tag === 'div' ? <div ref={merged}>div</div> : <section ref={merged}>section</section>;
    }
    const objectRef = React.createRef<HTMLElement>();
    const { rerender } = render(<Swap refs={[objectRef]} tag="div" />);
    expect(objectRef.current?.localName).toBe('div');
    rerender(<Swap refs={[objectRef]} tag="section" />);
    expect(objectRef.current?.localName).toBe('section');
  });

  describe('a ref only receives the node for a render it is part of (overlays#35)', () => {
    /** Renders the element only while `show`; the ref list comes from the parent. */
    function Conditional({
      show,
      refs,
    }: {
      show: boolean;
      refs: Array<React.Ref<HTMLDivElement>>;
    }) {
      const merged = useMergedRefs(...refs);
      return show ? <div ref={merged}>box</div> : null;
    }

    /** Merges one inline ref that `makeRef` creates during each render. */
    function Factory({ makeRef }: { makeRef: () => React.Ref<HTMLDivElement> }) {
      const merged = useMergedRefs(makeRef());
      return <div ref={merged}>box</div>;
    }

    /** Same, with a render-phase state update, so the first render is thrown away before commit. */
    function RenderPhaseUpdate({ makeRef }: { makeRef: () => React.Ref<HTMLDivElement> }) {
      const [ready, setReady] = React.useState(false);
      if (!ready) setReady(true);
      const merged = useMergedRefs(makeRef());
      return <div ref={merged}>{ready ? 'box' : 'pending'}</div>;
    }

    function makeRefFactory() {
      return vi.fn(() => vi.fn<(node: HTMLDivElement | null) => void>());
    }

    it('does not give an element that appears to a ref that left the list in the same commit', () => {
      const previous = vi.fn();
      const next = vi.fn();
      const { rerender } = render(<Conditional show={false} refs={[previous]} />);

      rerender(<Conditional show refs={[next]} />);

      expect(previous).not.toHaveBeenCalled();
      expect(next.mock.calls).toEqual([[screen.getByText('box')]]);
    });

    it('does not give a replacement element to a ref that left the list in the same commit', () => {
      function Swap({
        refs,
        tag,
      }: {
        refs: Array<React.Ref<HTMLElement>>;
        tag: 'div' | 'section';
      }) {
        const merged = useMergedRefs(...refs);
        return tag === 'div' ? (
          <div ref={merged}>div</div>
        ) : (
          <section ref={merged}>section</section>
        );
      }
      const previous = vi.fn();
      const next = vi.fn();
      const { rerender } = render(<Swap refs={[previous]} tag="div" />);
      const div = screen.getByText('div');

      rerender(<Swap refs={[next]} tag="section" />);

      expect(previous.mock.calls).toEqual([[div], [null]]);
      expect(next.mock.calls).toEqual([[screen.getByText('section')]]);
    });

    it('never gives the node to the inline ref of the first StrictMode render', () => {
      const makeRef = makeRefFactory();
      render(
        <React.StrictMode>
          <Factory makeRef={makeRef} />
        </React.StrictMode>,
      );
      const node = screen.getByText('box');
      const created = makeRef.mock.results.map((result) => result.value);

      expect(created.length).toBeGreaterThan(1);
      for (const discarded of created.slice(0, -1)) expect(discarded).not.toHaveBeenCalled();
      expect(created.at(-1)).toHaveBeenLastCalledWith(node);
    });

    it('never gives the node to the inline ref of a render discarded by a render-phase update', () => {
      const makeRef = makeRefFactory();
      render(<RenderPhaseUpdate makeRef={makeRef} />);
      const node = screen.getByText('box');
      const created = makeRef.mock.results.map((result) => result.value);

      expect(created).toHaveLength(2);
      expect(created[0]).not.toHaveBeenCalled();
      expect(created[1]?.mock.calls).toEqual([[node]]);
    });
  });

  describe('unstable refs (overlays#35)', () => {
    it('re-renders through a state update with an inline callback ref (no render loop)', async () => {
      const user = userEvent.setup();
      const propRef = React.createRef<HTMLButtonElement>();
      const onNode = vi.fn();
      render(<InlineMerge ref={propRef} onNode={onNode} />);
      const button = screen.getByRole('button', { name: 'clicked 0' });

      await user.click(button);
      await user.click(button);

      expect(button).toHaveTextContent('clicked 2');
      expect(propRef.current).toBe(button);
      expect(onNode).toHaveBeenLastCalledWith(button);
    });

    it('re-attaches an inline callback ref on each commit, like React does for inline refs', () => {
      const propRef = vi.fn();
      const onNode = vi.fn<(node: HTMLButtonElement | null) => void>();
      render(<InlineMerge ref={propRef} onNode={onNode} />);
      const button = screen.getByRole('button');
      act(() => {
        button.click();
      });
      act(() => {
        button.click();
      });
      // The stable prop ref is attached once; the inline ref detaches (null) and re-attaches per commit.
      expect(propRef).toHaveBeenCalledTimes(1);
      expect(onNode.mock.calls.map(([node]) => node)).toEqual([button, null, button, null, button]);
    });

    it('accepts a fresh mergeRefs(...) result on every render', () => {
      const first = React.createRef<HTMLButtonElement>();
      const second = vi.fn();
      render(<FreshMergeRefs first={first} second={second} />);
      const button = screen.getByRole('button');
      expect(() =>
        act(() => {
          button.click();
        }),
      ).not.toThrow();
      expect(button).toHaveTextContent('clicked 1');
      expect(first.current).toBe(button);
      expect(second).toHaveBeenLastCalledWith(button);
    });

    it('works under StrictMode with an inline ref', () => {
      const propRef = React.createRef<HTMLButtonElement>();
      const onNode = vi.fn();
      const { unmount } = render(
        <React.StrictMode>
          <InlineMerge ref={propRef} onNode={onNode} />
        </React.StrictMode>,
      );
      const button = screen.getByRole('button');
      act(() => {
        button.click();
      });
      expect(button).toHaveTextContent('clicked 1');
      expect(propRef.current).toBe(button);
      expect(onNode).toHaveBeenLastCalledWith(button);
      unmount();
      expect(propRef.current).toBeNull();
      expect(onNode).toHaveBeenLastCalledWith(null);
    });
  });
});
