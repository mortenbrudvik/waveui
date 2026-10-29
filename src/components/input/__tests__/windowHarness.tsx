/**
 * Helpers of the windowed picker tests (Combobox, Dropdown and Listbox with `virtualWindow`):
 * 10,000 items, a listbox that scrolls 250 pixels of 32-pixel options (jsdom has no layout, so its
 * `clientHeight` and `scrollHeight` are stubbed), the window's animation frames, and a window whose
 * `scrollToIndex` requests are seen and whose `keep` can be dropped.
 */
import * as React from 'react';
import { act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { useVirtualWindow, type VirtualWindow } from '../../../hooks/useVirtualWindow';
import type { ListboxItem } from '../../../hooks/useListbox';

/** The option height of every window here, in pixels. */
export const ITEM_SIZE = 32;
/** The `clientHeight` of a listbox. */
export const VIEWPORT = 250;
export const COUNT = 10_000;

/** Item 0 … Item 9999, values `item-0` … `item-9999`. */
export const MANY_ITEMS: readonly ListboxItem[] = Array.from({ length: COUNT }, (_, i) => ({
  value: `item-${i}`,
  label: `Item ${i}`,
}));

/** The `scrollTop` that shows option `index` in the middle of the listbox. */
export const centerOffset = (index: number): number =>
  index * ITEM_SIZE + ITEM_SIZE / 2 - VIEWPORT / 2;

/** `[from, to)`. */
export const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from }, (_, i) => from + i);

const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

const isListbox = (el: Element): boolean => el.getAttribute('role') === 'listbox';

/** The height of a listbox's content: the inline heights of its options and spacers. */
function contentHeight(el: Element): number {
  let height = 0;
  for (const child of Array.from(el.children)) {
    height += Number.parseFloat((child as HTMLElement).style.height) || 0;
  }
  return height;
}

/**
 * Stubs for one test (undo them with `vi.restoreAllMocks()`): `requestAnimationFrame`, whose
 * frames {@link runFrames} runs (the window reads a scroll in a frame), and a listbox's
 * `clientHeight` ({@link VIEWPORT}) and `scrollHeight` (its content, so `scrollToIndex` is bounded
 * as a browser bounds it).
 */
export function installWindowStubs(): void {
  frames.clear();
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return isListbox(this) ? VIEWPORT : 0;
  });
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
    return isListbox(this) ? contentHeight(this) : 0;
  });
}

/** Runs the animation frames requested so far, inside `act`. */
export function runFrames(): void {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  });
}

/** Sets the listbox's `scrollTop`, fires `scroll` and runs the window's frame. */
export function scrollList(list: HTMLElement, top: number): void {
  act(() => {
    list.scrollTop = top;
    fireEvent.scroll(list);
  });
  runFrames();
}

/**
 * The positions (`aria-posinset`) of the options rendered in `list`, in DOM order (also in a
 * detached element: server HTML).
 */
export function positions(list: Element): number[] {
  return Array.from(list.querySelectorAll(':scope > [role="option"]'), (option) =>
    Number(option.getAttribute('aria-posinset')),
  );
}

/** The spacers of `list` (its direct children with `data-virtual-spacer`), in DOM order. */
export function spacers(list: HTMLElement): HTMLElement[] {
  return Array.from(list.querySelectorAll<HTMLElement>(':scope > [data-virtual-spacer]'));
}

/** `list`'s children in DOM order: an option's position, or `'spacer'`. */
export function order(list: HTMLElement): (number | 'spacer')[] {
  return Array.from(list.querySelectorAll<HTMLElement>(':scope > li'), (el) =>
    el.hasAttribute('data-virtual-spacer') ? 'spacer' : Number(el.getAttribute('aria-posinset')),
  );
}

/** The `align` option of a `scrollToIndex` request. */
export type ScrollAlign = 'auto' | 'start' | 'center' | 'end';

/** Options of {@link useTestWindow}. */
export interface TestWindowOptions {
  /** Called after each `scrollToIndex` request was passed on to the window. */
  onScrollToIndex?: (index: number, options?: { align?: ScrollAlign }) => void;
  /**
   * Whether `layout` keeps the indexes it is asked to keep. `false` is an adapter that renders
   * the viewport only.
   * @default true
   */
  keep?: boolean;
}

/** `useVirtualWindow({ itemSize: 32 })`, seen through {@link TestWindowOptions}. */
export function useTestWindow({
  onScrollToIndex,
  keep = true,
}: TestWindowOptions = {}): VirtualWindow {
  const inner = useVirtualWindow({ itemSize: ITEM_SIZE });
  const { scrollRef, scrollToIndex } = inner;
  return React.useMemo<VirtualWindow>(
    () => ({
      itemSize: inner.itemSize,
      scrollRef,
      layout: (count, options) => inner.layout(count, keep ? options : undefined),
      scrollToIndex: (index, options) => {
        scrollToIndex(index, options);
        onScrollToIndex?.(index, options);
      },
    }),
    [inner, scrollRef, scrollToIndex, keep, onScrollToIndex],
  );
}
