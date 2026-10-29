import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { FlatTree } from '../FlatTree';
import type { FlatTreeProps } from '../FlatTree';
import { useFlatTree, type UseFlatTreeOptions } from '../useFlatTree';
import type { FlatTreeItemData } from '../../../lib/flatTree';
import { flatTreeClassNames } from '../../../lib/classNames';
import { useVirtualWindow, type UseVirtualWindowOptions } from '../../../hooks/useVirtualWindow';
import { expectNoA11yViolations } from '../../../test-utils';

/** The item height of the window, in pixels. */
const ITEM = 28;
/** The `clientHeight` of the tree (jsdom has no layout). */
const VIEWPORT = 400;
const ENTRIES = 4000;
const FOLDERS = 333;

/**
 * 5,000 items: "Archive" (`big`) with 4,000 entries, then 333 folders of two files each, the last
 * folder named "Zebra" (the only label that starts with z).
 */
function makeItems(): FlatTreeItemData[] {
  const items: FlatTreeItemData[] = [{ value: 'big', label: 'Archive' }];
  for (let i = 0; i < ENTRIES; i++) {
    items.push({ value: `entry-${i}`, parentValue: 'big', label: `Entry ${i}` });
  }
  for (let i = 0; i < FOLDERS; i++) {
    const value = `folder-${i}`;
    items.push({ value, label: i === FOLDERS - 1 ? 'Zebra' : `Folder ${i}` });
    items.push({ value: `${value}-a`, parentValue: value, label: `File ${i}a` });
    items.push({ value: `${value}-b`, parentValue: value, label: `File ${i}b` });
  }
  return items;
}
const ITEMS = makeItems();
const BIG_EXPANDED: readonly string[] = ['big'];
/** Rows with Archive expanded: Archive, its 4,000 entries and the 333 folders. */
const VISIBLE = 1 + ENTRIES + FOLDERS;
/** The largest `scrollTop`: the last row at the bottom of the viewport. */
const MAX_SCROLL = VISIBLE * ITEM - VIEWPORT;
/** Rows in view (400 / 28, rounded up) plus the overscan of 6 below them. */
const FIRST_WINDOW = 15 + 6;

/** Frames requested through the `requestAnimationFrame` stub, run by {@link runFrames}. */
const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

function runFrames(): void {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  });
}

const isScroller = (el: Element) => el.classList.contains(flatTreeClassNames.root);

beforeEach(() => {
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
    return isScroller(this) ? VIEWPORT : 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

type WindowedTreeProps = Omit<FlatTreeProps, 'model' | 'virtualWindow'> & {
  /** Options of the model; Archive is expanded by default. */
  options?: UseFlatTreeOptions;
  windowOptions?: Partial<UseVirtualWindowOptions>;
};

/** A FlatTree named "Archive" over the 5,000 items, with a window of 28-pixel rows. */
function WindowedTree({ options, windowOptions, ...props }: WindowedTreeProps) {
  const model = useFlatTree(ITEMS, { defaultExpandedItems: BIG_EXPANDED, ...options });
  const virtualWindow = useVirtualWindow({ itemSize: ITEM, ...windowOptions });
  return (
    <FlatTree
      aria-label="Archive"
      model={model}
      virtualWindow={virtualWindow}
      {...model.getTreeProps()}
      {...props}
    />
  );
}

/** A windowed tree whose expanded items a "Collapse all" button outside it clears. */
function CollapsibleTree(props: Omit<WindowedTreeProps, 'options'>) {
  const [expandedItems, setExpandedItems] = React.useState<readonly string[]>(BIG_EXPANDED);
  return (
    <>
      <WindowedTree
        {...props}
        options={{ expandedItems, onExpandedItemsChange: setExpandedItems }}
      />
      <button type="button" onClick={() => setExpandedItems([])}>
        Collapse all
      </button>
    </>
  );
}

const treeRoot = () => {
  const root = document.querySelector<HTMLElement>(`.${flatTreeClassNames.root}`);
  if (!root) throw new Error('no tree is rendered');
  return root;
};
const items = () =>
  Array.from(treeRoot().querySelectorAll<HTMLElement>(':scope > [role="treeitem"]'));
const spacers = () =>
  Array.from(treeRoot().querySelectorAll<HTMLElement>(':scope > [data-virtual-spacer]'));
const mountedIndexes = () => items().map((el) => Number(el.getAttribute('data-index')));
/** The tree's children in DOM order: an item's index, or `'spacer'`. */
const order = () =>
  Array.from(treeRoot().children, (el) =>
    el.hasAttribute('data-virtual-spacer') ? 'spacer' : Number(el.getAttribute('data-index')),
  );
const itemAt = (index: number) => {
  const el = treeRoot().querySelector<HTMLElement>(`:scope > [data-index="${index}"]`);
  if (!el) throw new Error(`item ${index} is not rendered`);
  return el;
};
const tabStops = () => items().filter((el) => el.tabIndex === 0);
/** `[from, to)`. */
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

/** Sets the tree's `scrollTop`, fires `scroll` and runs the window's frame. */
async function scrollTo(top: number): Promise<void> {
  act(() => {
    treeRoot().scrollTop = top;
    fireEvent.scroll(treeRoot());
  });
  runFrames();
  await act(async () => {});
}

async function focus(el: HTMLElement): Promise<void> {
  act(() => el.focus());
  await act(async () => {});
}

async function press(key: string): Promise<void> {
  act(() => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key });
  });
  await act(async () => {});
}

describe('FlatTree virtualWindow', () => {
  describe('rendering', () => {
    it('mounts at most 40 of the 5,000 items, with a spacer for the rest (budget)', () => {
      render(<WindowedTree />);
      expect(mountedIndexes()).toEqual(range(0, FIRST_WINDOW));
      expect(items().length).toBeLessThanOrEqual(40);
      expect(order()).toEqual([...range(0, FIRST_WINDOW), 'spacer']);
      const [spacer] = spacers();
      expect(spacer.localName).toBe('div');
      expect(spacer).toHaveAttribute('role', 'none');
      expect(spacer).toHaveAttribute('aria-hidden', 'true');
      expect(spacer).toHaveClass(flatTreeClassNames.spacer);
      expect(spacer.style.height).toBe(`${(VISIBLE - FIRST_WINDOW) * ITEM}px`);
      // The spacers are out of the accessibility tree.
      expect(screen.getAllByRole('treeitem')).toHaveLength(FIRST_WINDOW);
    });

    it('gives every item the window’s itemSize as its height', () => {
      render(<WindowedTree />);
      for (const el of items()) expect(el.style.height).toBe(`${ITEM}px`);
    });

    it('renders the items around the scroll position with a spacer on each side and their positions in the whole tree', async () => {
      render(<WindowedTree />);
      await scrollTo(3000 * ITEM);
      // The tab stop (the first item) stays rendered while the window is elsewhere.
      expect(mountedIndexes()).toEqual([0, ...range(2994, 3021)]);
      expect(items().length).toBeLessThanOrEqual(40);
      expect(order()).toEqual([0, 'spacer', ...range(2994, 3021), 'spacer']);
      expect(spacers().map((el) => el.style.height)).toEqual([
        `${(2994 - 1) * ITEM}px`,
        `${(VISIBLE - 3021) * ITEM}px`,
      ]);
      expect(tabStops()).toEqual([itemAt(0)]);
      const row = itemAt(3000);
      expect(row).toHaveAccessibleName('Entry 2999');
      expect(row).toHaveAttribute('aria-level', '2');
      expect(row).toHaveAttribute('aria-setsize', String(ENTRIES));
      expect(row).toHaveAttribute('aria-posinset', '3000');
    });

    it('passes axe at the top and with a kept item scrolled away', async () => {
      render(<WindowedTree />);
      await expectNoA11yViolations();
      await focus(itemAt(3));
      await scrollTo(2000 * ITEM);
      await expectNoA11yViolations();
    });
  });

  describe('focus survives scrolling (the focused item stays mounted)', () => {
    it('keeps a focused item mounted, focused and the tab stop when it is scrolled away and back', async () => {
      render(<WindowedTree />);
      const row = itemAt(5);
      await focus(row);
      await scrollTo(3000 * ITEM);
      expect(order()).toEqual(['spacer', 5, 'spacer', ...range(2994, 3021), 'spacer']);
      expect(row).toHaveFocus();
      expect(tabStops()).toEqual([row]);
      await scrollTo(0);
      expect(order()).toEqual([...range(0, FIRST_WINDOW), 'spacer']);
      expect(row).toHaveFocus();
      expect(itemAt(5)).toBe(row);
    });

    it('ArrowDown from an item kept outside the window moves to its index neighbour and scrolls to it', async () => {
      render(<WindowedTree />);
      await focus(itemAt(5));
      await scrollTo(3000 * ITEM);
      await press('ArrowDown');
      expect(itemAt(6)).toHaveFocus();
      expect(itemAt(6)).toHaveAccessibleName('Entry 5');
      expect(treeRoot().scrollTop).toBe(6 * ITEM);
      expect(tabStops()).toEqual([itemAt(6)]);
    });

    it('a pointer press focuses an item without scrolling; another focus scrolls it into view', async () => {
      render(<WindowedTree />);
      await scrollTo(100 * ITEM);
      // Row 95 is in the overscan above the view.
      act(() => {
        fireEvent.pointerDown(itemAt(95), { button: 0 });
        itemAt(95).focus();
      });
      await act(async () => {});
      expect(itemAt(95)).toHaveFocus();
      expect(treeRoot().scrollTop).toBe(100 * ITEM);
      await focus(itemAt(96));
      expect(treeRoot().scrollTop).toBe(96 * ITEM);
    });
  });

  describe('keys move over the whole tree', () => {
    it('End focuses the last visible item and scrolls it into view; Home returns', async () => {
      render(<WindowedTree />);
      await focus(itemAt(0));
      await press('End');
      const last = itemAt(VISIBLE - 1);
      expect(last).toHaveFocus();
      expect(last).toHaveAccessibleName('Zebra');
      expect(last).toHaveAttribute('aria-level', '1');
      expect(last).toHaveAttribute('aria-posinset', String(1 + FOLDERS));
      expect(last).toHaveAttribute('aria-setsize', String(1 + FOLDERS));
      expect(treeRoot().scrollTop).toBe(MAX_SCROLL);
      // The window is at the end in the same update; the first item is no longer kept.
      expect(order()).toEqual(['spacer', ...range(VISIBLE - FIRST_WINDOW, VISIBLE)]);
      expect(tabStops()).toEqual([last]);
      await press('Home');
      expect(itemAt(0)).toHaveFocus();
      expect(treeRoot().scrollTop).toBe(0);
      expect(order()).toEqual([...range(0, FIRST_WINDOW), 'spacer']);
    });

    it('ArrowRight on the last mounted item, a collapsed branch, expands it and keeps focus', async () => {
      render(<WindowedTree />);
      await scrollTo(4300 * ITEM);
      const last = items().at(-1) as HTMLElement;
      expect(last).toHaveAccessibleName('Folder 319');
      expect(last).toHaveAttribute('aria-expanded', 'false');
      await focus(last);
      await press('ArrowRight');
      expect(last).toHaveAttribute('aria-expanded', 'true');
      expect(last).toHaveFocus();
      expect(last.isConnected).toBe(true);
      const index = Number(last.getAttribute('data-index'));
      expect(itemAt(index + 1)).toHaveAccessibleName('File 319a');
      expect(itemAt(index + 1)).toHaveAttribute('aria-level', '2');
      expect(items().length).toBeLessThanOrEqual(40);
    });

    it('typeahead reaches a visible item that is not mounted, scrolling it into view', async () => {
      render(<WindowedTree />);
      await focus(itemAt(0));
      await press('z');
      expect(itemAt(VISIBLE - 1)).toHaveFocus();
      expect(itemAt(VISIBLE - 1)).toHaveAccessibleName('Zebra');
      expect(treeRoot().scrollTop).toBe(MAX_SCROLL);
    });
  });

  describe('collapsing under a scrolled window (Review Focus 3)', () => {
    it('clamps the window to the shorter list and keeps the tab stop mounted', async () => {
      render(<CollapsibleTree />);
      await scrollTo(3000 * ITEM);
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
      });
      await act(async () => {});
      const rows = 1 + FOLDERS;
      const indexes = mountedIndexes();
      expect(new Set(indexes).size).toBe(indexes.length);
      for (const index of indexes) {
        expect(Number.isInteger(index)).toBe(true);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(rows);
      }
      // The window is clamped to the last rows; the tab stop (the first item) is kept.
      expect(order()).toEqual([0, 'spacer', ...range(rows - FIRST_WINDOW, rows)]);
      expect(spacers()[0].style.height).toBe(`${(rows - FIRST_WINDOW - 1) * ITEM}px`);
      expect(tabStops()).toEqual([itemAt(0)]);
    });

    it('moves focus and the tab stop to the collapsed branch when focus was deep inside it', async () => {
      render(<CollapsibleTree />);
      await scrollTo(3000 * ITEM);
      await focus(itemAt(3000));
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
      });
      await act(async () => {});
      const archive = itemAt(0);
      expect(archive).toHaveAccessibleName('Archive');
      expect(archive).toHaveAttribute('aria-expanded', 'false');
      expect(archive).toHaveFocus();
      expect(tabStops()).toEqual([archive]);
      expect(treeRoot().scrollTop).toBe(0);
      expect(order()).toEqual([...range(0, FIRST_WINDOW), 'spacer']);
    });

    it('scrolls to the collapsed branch and focuses it when the clamped window does not render it', async () => {
      // The selected folder is the tab stop after the collapse, so the branch is not kept.
      render(<CollapsibleTree selected="folder-300" />);
      await scrollTo(3000 * ITEM);
      await focus(itemAt(3000));
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
      });
      await act(async () => {});
      const archive = itemAt(0);
      expect(archive).toHaveAccessibleName('Archive');
      expect(archive).toHaveFocus();
      expect(tabStops()).toEqual([archive]);
      expect(treeRoot().scrollTop).toBe(0);
      expect(order()).toEqual([...range(0, FIRST_WINDOW), 'spacer']);
    });
  });

  describe('server render', () => {
    /** Rows in the assumed viewport of 480 pixels (480 / 28, rounded up) plus the overscan. */
    const SERVER_WINDOW = 18 + 6;

    it('renders the first window only on the server', () => {
      const html = renderToString(<WindowedTree />);
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const rows = Array.from(parsed.querySelectorAll('[role="treeitem"]'));
      expect(rows.map((el) => el.getAttribute('data-index'))).toEqual(
        range(0, SERVER_WINDOW).map(String),
      );
      expect(rows[0].getAttribute('tabindex')).toBe('0');
      expect(rows[1].getAttribute('aria-setsize')).toBe(String(ENTRIES));
      const serverSpacers = parsed.querySelectorAll('[data-virtual-spacer]');
      expect(serverSpacers).toHaveLength(1);
      expect(serverSpacers[0].getAttribute('style')).toContain(
        `${(VISIBLE - SERVER_WINDOW) * ITEM}px`,
      );
    });

    it('hydrates the server window without a mismatch', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const ui = <WindowedTree />;
      const container = document.createElement('div');
      container.innerHTML = renderToString(ui);
      document.body.appendChild(container);
      let root: Root | undefined;
      try {
        act(() => {
          root = hydrateRoot(container, ui);
        });
        await act(async () => {});
        expect(mountedIndexes()).toEqual(range(0, FIRST_WINDOW));
        expect(error).not.toHaveBeenCalled();
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });
  });
});
