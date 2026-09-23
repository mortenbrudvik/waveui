import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render } from '@testing-library/react';
import { mergeRefs, setRef } from '../mergeRefs';

describe('setRef', () => {
  it('assigns object refs', () => {
    const ref = React.createRef<HTMLDivElement>();
    const node = document.createElement('div');
    setRef(ref, node);
    expect(ref.current).toBe(node);
    setRef(ref, null);
    expect(ref.current).toBeNull();
  });

  it('calls callback refs and returns their cleanup', () => {
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);
    const node = document.createElement('div');
    expect(setRef(callback, node)).toBe(cleanup);
    expect(callback).toHaveBeenCalledWith(node);
  });

  it('ignores null and undefined refs', () => {
    expect(() => setRef(null, document.createElement('div'))).not.toThrow();
    expect(() => setRef(undefined, document.createElement('div'))).not.toThrow();
  });
});

describe('mergeRefs (overlays#35)', () => {
  it('forwards the node to object and callback refs', () => {
    const objectRef = React.createRef<HTMLDivElement>();
    const callbackRef = vi.fn();
    render(React.createElement('div', { ref: mergeRefs(objectRef, callbackRef) }));
    expect(objectRef.current).toBeInstanceOf(HTMLDivElement);
    expect(callbackRef).toHaveBeenCalledWith(objectRef.current);
  });

  it('skips null and undefined refs', () => {
    const objectRef = React.createRef<HTMLDivElement>();
    render(React.createElement('div', { ref: mergeRefs(null, undefined, objectRef) }));
    expect(objectRef.current).toBeInstanceOf(HTMLDivElement);
  });

  it('supports React 19 callback-ref cleanups: the cleanup runs on unmount instead of a null call', () => {
    const cleanup = vi.fn();
    const received: Array<HTMLDivElement | null> = [];
    const cleanupRef = (node: HTMLDivElement | null) => {
      received.push(node);
      return cleanup;
    };
    const { unmount } = render(React.createElement('div', { ref: mergeRefs(cleanupRef) }));
    expect(received).toHaveLength(1);
    expect(received[0]).toBeInstanceOf(HTMLDivElement);
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(received).toHaveLength(1); // never called with null
  });

  it('resets object refs and calls non-cleanup callbacks with null on detach', () => {
    const objectRef = React.createRef<HTMLDivElement>();
    const plain = vi.fn();
    const { unmount } = render(React.createElement('div', { ref: mergeRefs(objectRef, plain) }));
    const node = objectRef.current;
    expect(node).toBeInstanceOf(HTMLDivElement);
    unmount();
    expect(objectRef.current).toBeNull();
    expect(plain.mock.calls).toEqual([[node], [null]]);
  });

  it('mixes cleanup refs, plain callbacks and object refs in one merge', () => {
    const cleanup = vi.fn();
    const cleanupRef = vi.fn(() => cleanup);
    const plain = vi.fn();
    const objectRef = React.createRef<HTMLDivElement>();
    const { unmount } = render(
      React.createElement('div', { ref: mergeRefs(cleanupRef, plain, objectRef) }),
    );
    unmount();
    expect(cleanupRef).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(plain).toHaveBeenLastCalledWith(null);
    expect(objectRef.current).toBeNull();
  });

  it('attaches once across re-renders when the merged ref is memoised', () => {
    const callbackRef = vi.fn();
    function Probe({ label }: { label: string }) {
      const merged = React.useMemo(() => mergeRefs<HTMLDivElement>(callbackRef), []);
      return React.createElement('div', { ref: merged }, label);
    }
    const { rerender } = render(React.createElement(Probe, { label: 'a' }));
    rerender(React.createElement(Probe, { label: 'b' }));
    rerender(React.createElement(Probe, { label: 'c' }));
    expect(callbackRef).toHaveBeenCalledTimes(1);
  });

  it('propagates a manual null call to every ref', () => {
    const objectRef = { current: document.createElement('div') as HTMLDivElement | null };
    const plain = vi.fn();
    mergeRefs(objectRef, plain)(null);
    expect(objectRef.current).toBeNull();
    expect(plain).toHaveBeenCalledWith(null);
  });
});
