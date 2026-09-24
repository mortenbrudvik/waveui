import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTypeahead, type TypeaheadItem } from '../useTypeahead';

const FRUITS: TypeaheadItem[] = [
  { value: 'apple', text: 'Apple' },
  { value: 'banana', text: 'Banana' },
  { value: 'blueberry', text: 'Blueberry' },
  { value: 'cherry', text: 'Cherry', disabled: true },
  { value: 'coconut', text: 'Coconut' },
  { value: 'new-york', text: 'New York' },
];

function key(k: string, init: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: k, ...init });
}

function setup(items: TypeaheadItem[] = FRUITS, timeout?: number) {
  const onMatch = vi.fn();
  const hook = renderHook(() => useTypeahead({ getItems: () => items, onMatch, timeout }));
  return { onMatch, type: hook.result.current.onTypeahead, hook };
}

describe('useTypeahead', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves to the first item starting with the typed character after the current one', () => {
    const { onMatch, type } = setup();
    expect(type(key('b'), 'apple')).toBe(true);
    expect(onMatch).toHaveBeenLastCalledWith('banana');
  });

  it('cycles through items with the same first letter when the letter repeats', () => {
    const { onMatch, type } = setup();
    type(key('b'), 'apple');
    expect(onMatch).toHaveBeenLastCalledWith('banana');
    type(key('b'), 'banana');
    expect(onMatch).toHaveBeenLastCalledWith('blueberry');
    type(key('b'), 'blueberry');
    expect(onMatch).toHaveBeenLastCalledWith('banana');
  });

  it('matches a multi-character prefix typed within the timeout', () => {
    const { onMatch, type } = setup();
    type(key('b'), null);
    type(key('l'), 'banana');
    expect(onMatch).toHaveBeenLastCalledWith('blueberry');
  });

  it('keeps the current item while it still matches the growing prefix', () => {
    const { onMatch, type } = setup();
    type(key('b'), 'apple');
    expect(onMatch).toHaveBeenLastCalledWith('banana');
    type(key('a'), 'banana');
    expect(onMatch).toHaveBeenLastCalledWith('banana');
  });

  it('resets the buffer after the timeout (500 ms by default)', () => {
    const { onMatch, type } = setup();
    type(key('b'), 'apple');
    vi.advanceTimersByTime(499);
    type(key('l'), 'banana');
    expect(onMatch).toHaveBeenLastCalledWith('blueberry');
    vi.advanceTimersByTime(500);
    type(key('a'), 'blueberry');
    expect(onMatch).toHaveBeenLastCalledWith('apple');
  });

  it('honours a custom timeout', () => {
    const { onMatch, type } = setup(FRUITS, 100);
    type(key('b'), null);
    vi.advanceTimersByTime(150);
    type(key('c'), 'banana');
    expect(onMatch).toHaveBeenLastCalledWith('coconut');
  });

  it('skips disabled items', () => {
    const { onMatch, type } = setup();
    type(key('c'), 'apple');
    expect(onMatch).toHaveBeenLastCalledWith('coconut');
  });

  it('wraps around from the current item', () => {
    const { onMatch, type } = setup();
    type(key('a'), 'coconut');
    expect(onMatch).toHaveBeenLastCalledWith('apple');
  });

  it('is case-insensitive', () => {
    const { onMatch, type } = setup();
    type(key('B', { shiftKey: true }), null);
    expect(onMatch).toHaveBeenLastCalledWith('banana');
  });

  it('appends a space once a search is in progress', () => {
    const { onMatch, type } = setup([
      { value: 'new-jersey', text: 'New Jersey' },
      { value: 'new-york', text: 'New York' },
      { value: 'newark', text: 'Newark' },
    ]);
    type(key('n'), null);
    type(key('e'), 'new-jersey');
    type(key('w'), 'new-jersey');
    expect(type(key(' '), 'new-jersey')).toBe(true);
    type(key('y'), 'new-jersey');
    expect(onMatch).toHaveBeenLastCalledWith('new-york');
  });

  it('ignores a leading space, non-printable keys and modifier shortcuts', () => {
    const { onMatch, type } = setup();
    expect(type(key(' '), null)).toBe(false);
    expect(type(key('ArrowDown'), null)).toBe(false);
    expect(type(key('Enter'), null)).toBe(false);
    expect(type(key('b', { ctrlKey: true }), null)).toBe(false);
    expect(type(key('b', { metaKey: true }), null)).toBe(false);
    expect(type(key('b', { altKey: true }), null)).toBe(false);
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('accepts a character typed with AltGr (reported as Ctrl+Alt on Windows)', () => {
    const { onMatch, type } = setup([
      { value: 'warszawa', text: 'Warszawa' },
      { value: 'lodz', text: 'Łódź' },
    ]);
    expect(type(key('ł', { ctrlKey: true, altKey: true }), null)).toBe(true);
    expect(onMatch).toHaveBeenLastCalledWith('lodz');
    expect(type(key('ł', { ctrlKey: true, altKey: true, metaKey: true }), null)).toBe(false);
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('returns false and does not call onMatch when nothing matches', () => {
    const { onMatch, type } = setup();
    expect(type(key('z'), null)).toBe(false);
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('reports a search in progress from the first character, matched or not, until the timeout', () => {
    const { type, hook } = setup(FRUITS, 500);
    const isSearching = () => hook.result.current.isSearching();
    expect(isSearching()).toBe(false);
    expect(type(key('z'), null)).toBe(false);
    expect(isSearching()).toBe(true);
    vi.advanceTimersByTime(499);
    expect(isSearching()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isSearching()).toBe(false);
  });

  it('consumes a space that continues a search even when nothing matches', () => {
    const { onMatch, type } = setup([
      { value: 'cat', text: 'Cat' },
      { value: 'dog', text: 'Dog' },
    ]);
    expect(type(key('c'), null)).toBe(true);
    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(type(key(' '), 'cat')).toBe(true);
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('keeps a stable handler that reads the latest items and callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ items, onMatch }: { items: TypeaheadItem[]; onMatch: (v: string) => void }) =>
        useTypeahead({ getItems: () => items, onMatch }),
      { initialProps: { items: FRUITS.slice(0, 2), onMatch: first } },
    );
    const handler = result.current.onTypeahead;
    rerender({ items: [{ value: 'zebra', text: 'Zebra' }], onMatch: second });
    expect(result.current.onTypeahead).toBe(handler);
    result.current.onTypeahead(key('z'), null);
    expect(second).toHaveBeenCalledWith('zebra');
    expect(first).not.toHaveBeenCalled();
  });

  it('clears its timer on unmount', () => {
    const { type, hook } = setup();
    type(key('b'), null);
    hook.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
