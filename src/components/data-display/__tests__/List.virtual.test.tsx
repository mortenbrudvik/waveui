import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { List } from '../List';
import type { ListProps } from '../List';
import { ListRegistry } from '../List.registry';
import { listClassNames } from '../../../lib/classNames';
import {
  useVirtualWindow,
  type UseVirtualWindowOptions,
  type VirtualWindow,
} from '../../../hooks/useVirtualWindow';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

/** The item height of every window here, in pixels. */
const ITEM = 44;
/** The `clientHeight` of the list (jsdom has no layout). */
const VIEWPORT = 480;
const COUNT = 10_000;

/** Frames requested through the `requestAnimationFrame` stub, run by {@link runFrames}. */
const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

/** Runs the frames requested so far (the window reads a scroll in a frame), inside `act`. */
function runFrames(): void {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  });
}

const isScroller = (el: Element) => el.classList.contains(listClassNames.root);

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

/** An item per index: value `file-<index>`, text `File <index>`. */
const fileItem = (index: number) => (
  <List.Item value={`file-${index}`}>{`File ${index}`}</List.Item>
);

type WindowedListProps = Omit<ListProps, 'children' | 'virtualWindow' | 'count'> & {
  /** @default 10,000 */
  count?: number;
  /** Options of the list's `useVirtualWindow` (`itemSize` 44). */
  windowOptions?: Partial<UseVirtualWindowOptions>;
  /** The function child. @default {@link fileItem} */
  renderItem?: (index: number) => React.ReactNode;
};

/** A List named "Files" with a window over `count` items. */
function WindowedList({
  count = COUNT,
  windowOptions,
  renderItem = fileItem,
  ...props
}: WindowedListProps) {
  const virtualWindow = useVirtualWindow({ itemSize: ITEM, ...windowOptions });
  return (
    <List aria-label="Files" {...props} virtualWindow={virtualWindow} count={count}>
      {renderItem}
    </List>
  );
}

const listRoot = () => {
  const root = document.querySelector<HTMLElement>(`.${listClassNames.root}`);
  if (!root) throw new Error('no list is rendered');
  return root;
};
/** The rendered items (spacers left out), in DOM order. */
const items = () => Array.from(listRoot().querySelectorAll<HTMLElement>(':scope > [data-index]'));
const spacers = () =>
  Array.from(listRoot().querySelectorAll<HTMLElement>(':scope > [data-virtual-spacer]'));
const mountedIndexes = () => items().map((el) => Number(el.getAttribute('data-index')));
/** The list's children in DOM order: an item's index, or `'spacer'`. */
const order = () =>
  Array.from(listRoot().children, (el) =>
    el.hasAttribute('data-virtual-spacer') ? 'spacer' : Number(el.getAttribute('data-index')),
  );
const item = (index: number) => {
  const el = listRoot().querySelector<HTMLElement>(`:scope > [data-index="${index}"]`);
  if (!el) throw new Error(`item ${index} is not rendered`);
  return el;
};
const option = (name: string) => screen.getByRole('option', { name });
/** `[from, to)`. */
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

/**
 * Sets the list's `scrollTop`, fires `scroll` and runs the window's frame; then lets the roving
 * tab index hook's observer (a microtask) re-read the items inside `act`.
 */
async function scrollTo(top: number): Promise<void> {
  act(() => {
    listRoot().scrollTop = top;
    fireEvent.scroll(listRoot());
  });
  runFrames();
  await act(async () => {});
}

async function focus(el: HTMLElement): Promise<void> {
  act(() => el.focus());
  await act(async () => {});
}

/**
 * Presses `key` on the focused element, then lets the observers re-read the items (inside `act`).
 * Returns whether the key was left alone (its default not prevented).
 */
async function press(key: string): Promise<boolean> {
  let unhandled = true;
  act(() => {
    unhandled = fireEvent.keyDown(document.activeElement ?? document.body, { key });
  });
  await act(async () => {});
  return unhandled;
}

/** The largest `scrollTop` of the list: the last item at the bottom of the viewport. */
const MAX_SCROLL = COUNT * ITEM - VIEWPORT;

/** The bare `[WaveUI]` messages `warn` was called with. */
const messages = (warn: { mock: { calls: unknown[][] } }) => warn.mock.calls.map((call) => call[0]);

const CHILDREN_WARNING =
  '[WaveUI] List: a windowed list needs `virtualWindow`, `count` and a function child that ' +
  'returns the `List.Item` at an index; without one of them the window is ignored (a function ' +
  'child then renders nothing, and element children are all rendered).';

const ACTIONS_WARNING =
  '[WaveUI] List: a selectable windowed list keeps its listbox structure whatever items are ' +
  'rendered, so an item action sits inside an option, which cannot hold interactive content. ' +
  'Set navigationMode="composite" to render a grid whose rows hold the actions.';

/** An item per index, with an "Open" action from index 100 on. */
const laterActionItem = (index: number) => (
  <List.Item
    value={`file-${index}`}
    action={index >= 100 ? <button type="button">{`Open ${index}`}</button> : undefined}
  >
    {`File ${index}`}
  </List.Item>
);

/** An item per index, each with an "Open" action. */
const actionItem = (index: number) => (
  <List.Item value={`file-${index}`} action={<button type="button">{`Open ${index}`}</button>}>
    {`File ${index}`}
  </List.Item>
);

/** An item per index without a value: a focus restore can only find it by its index. */
const unvaluedItem = (index: number) => <List.Item>{`File ${index}`}</List.Item>;

/** An item per index, the last one named "Zebra" (the only name that starts with z). */
const zebraItem = (index: number) => (
  <List.Item value={`file-${index}`}>{index === COUNT - 1 ? 'Zebra' : `File ${index}`}</List.Item>
);

/** An item per index, each with a "Rename" text field as its action. */
const inputItem = (index: number) => (
  <List.Item value={`file-${index}`} action={<input aria-label={`Rename ${index}`} />}>
    {`File ${index}`}
  </List.Item>
);

/** A button rendered into `document.body` through a portal: a popup an item opened. */
function PortalButton({ children }: { children: string }) {
  return createPortal(<button type="button">{children}</button>, document.body);
}

/** An item per index; item 3 has an "Open 3" button and a "Menu 3" button in a portal. */
const popupItem = (index: number) => (
  <List.Item
    action={
      index === 3 ? (
        <>
          <button type="button">Open 3</button>
          <PortalButton>Menu 3</PortalButton>
        </>
      ) : undefined
    }
  >
    {`File ${index}`}
  </List.Item>
);

describe('List virtualWindow', () => {
  describe('rendering', () => {
    it('renders the first window within the budget: the items in view, the overscan and one spacer', () => {
      render(<WindowedList />);
      // 480 / 44: 11 items in view, 6 below; none above the first item.
      expect(mountedIndexes()).toEqual(range(0, 17));
      expect(items().length).toBeLessThanOrEqual(40);
      expect(order()).toEqual([...range(0, 17), 'spacer']);
      const [spacer] = spacers();
      expect(spacer.localName).toBe('li');
      expect(spacer).toHaveAttribute('aria-hidden', 'true');
      expect(spacer).toHaveAttribute('role', 'presentation');
      expect(spacer).toHaveClass(listClassNames.spacer);
      expect(spacer.style.height).toBe(`${(COUNT - 17) * ITEM}px`);
      // The spacers are out of the accessibility tree.
      expect(screen.getAllByRole('listitem')).toHaveLength(17);
    });

    it('renders the items around the scroll position with a spacer on each side', async () => {
      render(<WindowedList />);
      await scrollTo(5000 * ITEM);
      expect(mountedIndexes()).toEqual(range(4994, 5017));
      expect(items().length).toBeLessThanOrEqual(40);
      expect(order()).toEqual(['spacer', ...range(4994, 5017), 'spacer']);
      expect(spacers().map((el) => el.style.height)).toEqual([
        `${4994 * ITEM}px`,
        `${(COUNT - 5017) * ITEM}px`,
      ]);
      // Items and spacers add up to the whole list.
      const total = [...items(), ...spacers()].reduce(
        (sum, el) => sum + parseFloat(el.style.height),
        0,
      );
      expect(total).toBe(COUNT * ITEM);
    });

    it('gives every item the window’s itemSize as its height', async () => {
      render(<WindowedList selectable />);
      expect(items().map((el) => el.style.height)).toEqual(Array(17).fill(`${ITEM}px`));
      await scrollTo(5000 * ITEM);
      expect(items().map((el) => el.style.height)).toEqual(Array(23).fill(`${ITEM}px`));
    });

    it('keeps an item’s own style next to the height, which the list sets', () => {
      render(
        <WindowedList
          renderItem={(index) => (
            <List.Item style={{ color: 'inherit', height: 10 }}>{`File ${index}`}</List.Item>
          )}
        />,
      );
      expect(item(0).style.color).toBe('inherit');
      expect(item(0).style.height).toBe(`${ITEM}px`);
    });

    it('makes the list its scroller (it scrolls vertically) and calls the child for the rendered indexes only', () => {
      const renderItem = vi.fn(fileItem);
      render(<WindowedList renderItem={renderItem} />);
      const called = new Set(renderItem.mock.calls.map(([index]) => index));
      expect([...called].sort((a, b) => a - b)).toEqual(range(0, 17));
      expect(listRoot().className).toContain('overflow-y-auto');
    });

    it('re-renders its items at a row boundary, not on every scroll event', async () => {
      const renderItem = vi.fn(fileItem);
      render(<WindowedList renderItem={renderItem} />);
      renderItem.mockClear();
      await scrollTo(10);
      await scrollTo(30);
      expect(renderItem).not.toHaveBeenCalled();
      await scrollTo(ITEM);
      expect(renderItem).toHaveBeenCalled();
      expect(mountedIndexes()).toEqual(range(0, 18));
    });

    it('a list without a window is unchanged: no index, position, height or spacer', () => {
      render(
        <List aria-label="Fruits" selectable>
          <List.Item value="a">Apple</List.Item>
          <List.Item value="b">Banana</List.Item>
        </List>,
      );
      const apple = option('Apple');
      expect(apple).not.toHaveAttribute('data-index');
      expect(apple).not.toHaveAttribute('aria-setsize');
      expect(apple).not.toHaveAttribute('aria-posinset');
      expect(apple).not.toHaveAttribute('style');
      expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-rowcount');
      expect(screen.getByRole('listbox').className).not.toContain('overflow-y-auto');
      expect(document.querySelector('[data-virtual-spacer]')).toBeNull();
    });

    it('right to left: the window sets only heights (no physical property)', async () => {
      renderWithProviders(<WindowedList />, { dir: 'rtl' });
      await scrollTo(5000 * ITEM);
      expect(items()[0].getAttribute('style')).toBe(`height: ${ITEM}px;`);
      expect(spacers().map((el) => el.getAttribute('style'))).toEqual([
        `height: ${4994 * ITEM}px;`,
        `height: ${(COUNT - 5017) * ITEM}px;`,
      ]);
    });
  });

  describe('positions', () => {
    it('gives each option its index and its position in the whole list', async () => {
      render(<WindowedList selectable />);
      const first = option('File 0');
      expect(first).toHaveAttribute('data-index', '0');
      expect(first).toHaveAttribute('aria-setsize', String(COUNT));
      expect(first).toHaveAttribute('aria-posinset', '1');
      await scrollTo(5000 * ITEM);
      expect(option('File 5000')).toHaveAttribute('aria-posinset', '5001');
      expect(option('File 5000')).toHaveAttribute('data-index', '5000');
    });

    it('gives the items of a plain list their positions', () => {
      render(<WindowedList />);
      const [first, second] = screen.getAllByRole('listitem');
      expect(first).toHaveAttribute('aria-setsize', String(COUNT));
      expect(first).toHaveAttribute('aria-posinset', '1');
      expect(second).toHaveAttribute('aria-posinset', '2');
    });

    it('a grid carries aria-rowcount and its rows aria-rowindex (not a set size)', async () => {
      render(<WindowedList navigationMode="composite" />);
      const grid = screen.getByRole('grid', { name: 'Files' });
      expect(grid).toHaveAttribute('aria-rowcount', String(COUNT));
      const [first] = screen.getAllByRole('row');
      expect(first).toHaveAttribute('aria-rowindex', '1');
      expect(first).toHaveAttribute('data-index', '0');
      expect(first).not.toHaveAttribute('aria-setsize');
      expect(first).not.toHaveAttribute('aria-posinset');
      // Spacers in a grid are elements a grid may hold.
      expect(spacers()[0].localName).toBe('div');
      await scrollTo(5000 * ITEM);
      expect(item(5000)).toHaveAttribute('aria-rowindex', '5001');
      await expectNoA11yViolations();
    });

    it('leaves the spacers out of the arrow-key order and the Tab order', async () => {
      render(<WindowedList selectable />);
      await scrollTo(5000 * ITEM);
      for (const spacer of spacers()) {
        expect(spacer).not.toHaveAttribute('data-roving-value');
        expect(spacer).not.toHaveAttribute('tabindex');
      }
      expect(listRoot().querySelectorAll(':scope > [data-roving-value]')).toHaveLength(23);
    });

    it('passes axe at the top and with a kept item scrolled away', async () => {
      render(<WindowedList selectable selectionMode="multiple" />);
      await expectNoA11yViolations();
      await focus(option('File 2'));
      await scrollTo(5000 * ITEM);
      await expectNoA11yViolations();
    });
  });

  describe('selection keeps the values of items that are not rendered', () => {
    it('reports the selected values outside the window with a toggle', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();
      render(
        <WindowedList
          selectable
          selectionMode="multiple"
          defaultSelectedItems={['file-5000', 'file-3']}
          onSelectionChange={onSelectionChange}
        />,
      );
      expect(option('File 3')).toHaveAttribute('aria-selected', 'true');
      await user.click(option('File 1'));
      expect(onSelectionChange).toHaveBeenLastCalledWith(['file-5000', 'file-3', 'file-1']);

      await scrollTo(5000 * ITEM);
      expect(option('File 5000')).toHaveAttribute('aria-selected', 'true');
      await user.click(option('File 5000'));
      expect(onSelectionChange).toHaveBeenLastCalledWith(['file-3', 'file-1']);
      expect(onSelectionChange).toHaveBeenCalledTimes(2);
    });

    it('keeps controlled values that match no rendered item (the unwindowed list drops them)', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();
      render(
        <WindowedList
          selectable
          selectionMode="multiple"
          selectedItems={['ghost', 'file-9999']}
          onSelectionChange={onSelectionChange}
        />,
      );
      await user.click(option('File 0'));
      expect(onSelectionChange).toHaveBeenCalledWith(['ghost', 'file-9999', 'file-0']);
    });

    it('single mode: a click replaces a value outside the window, a second click clears it', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();
      const onSelectedItemChange = vi.fn();
      render(
        <WindowedList
          selectable
          defaultSelectedItem="file-5000"
          onSelectionChange={onSelectionChange}
          onSelectedItemChange={onSelectedItemChange}
        />,
      );
      await user.click(option('File 1'));
      expect(onSelectionChange).toHaveBeenLastCalledWith(['file-1']);
      expect(onSelectedItemChange).toHaveBeenLastCalledWith('file-1');
      await user.click(option('File 1'));
      expect(onSelectionChange).toHaveBeenLastCalledWith([]);
      expect(onSelectedItemChange).toHaveBeenLastCalledWith(null);
    });

    it('counts every given value, rendered or not, for the single-mode warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = render(<WindowedList selectable selectedItems={['file-1']} />);
      await act(async () => {});
      expect(warn).not.toHaveBeenCalled();
      // After the items registered: a value of an item that is not rendered still counts.
      rerender(<WindowedList selectable selectedItems={['file-1', 'file-5000']} />);
      await act(async () => {});
      expect(option('File 1')).toHaveAttribute('aria-selected', 'true');
      expect(messages(warn)).toEqual([
        '[WaveUI] List: a single-selection list (selectionMode "single") received 2 selected items. Pass one value with `selectedItem`, or use selectionMode="multiple".',
      ]);
    });

    it('calls onSelectionChange once per click in StrictMode', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();
      render(
        <React.StrictMode>
          <WindowedList
            selectable
            selectionMode="multiple"
            defaultSelectedItems={['file-5000']}
            onSelectionChange={onSelectionChange}
          />
        </React.StrictMode>,
      );
      await user.click(option('File 1'));
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      await user.click(option('File 2'));
      expect(onSelectionChange).toHaveBeenCalledTimes(2);
      expect(onSelectionChange).toHaveBeenLastCalledWith(['file-5000', 'file-1', 'file-2']);
      expect(mountedIndexes()).toEqual(range(0, 17));
    });

    it('puts the Tab stop on the first selected item by index after items mounted above it', async () => {
      render(
        <WindowedList
          selectable
          selectionMode="multiple"
          defaultSelectedItems={['file-5000', 'file-4985']}
        />,
      );
      await scrollTo(5000 * ITEM);
      expect(option('File 5000')).toHaveAttribute('tabindex', '0');
      // Items 4984..4993 mount after 5000 (and register later): the order is by index.
      await scrollTo(4990 * ITEM);
      expect(mountedIndexes()).toEqual(range(4984, 5007));
      expect(option('File 4985')).toHaveAttribute('tabindex', '0');
      expect(option('File 5000')).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('focus survives scrolling (the focused item stays rendered)', () => {
    it('keeps a focused option rendered and focused when it is scrolled away and back', async () => {
      render(<WindowedList selectable />);
      const focused = option('File 2');
      await focus(focused);
      await scrollTo(5000 * ITEM);
      expect(order()).toEqual(['spacer', 2, 'spacer', ...range(4994, 5017), 'spacer']);
      expect(spacers().map((el) => el.style.height)).toEqual([
        `${2 * ITEM}px`,
        `${(4994 - 3) * ITEM}px`,
        `${(COUNT - 5017) * ITEM}px`,
      ]);
      expect(document.activeElement).toBe(focused);
      expect(focused).toHaveAttribute('aria-posinset', '3');
      expect(items().length).toBeLessThanOrEqual(40);

      await scrollTo(0);
      expect(order()).toEqual([...range(0, 17), 'spacer']);
      expect(document.activeElement).toBe(focused);
    });

    it('keeps the Tab stop on the item that had focus (navigationMode="items")', async () => {
      render(<WindowedList navigationMode="items" />);
      const focused = item(2);
      await focus(focused);
      expect(focused).toHaveAttribute('tabindex', '0');
      await scrollTo(5000 * ITEM);
      expect(item(2)).toBe(focused);
      expect(focused).toHaveAttribute('tabindex', '0');
      expect(listRoot().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
      expect(document.activeElement).toBe(focused);
    });

    it('keeps the item of a focused action rendered in a plain list', async () => {
      render(
        <WindowedList
          renderItem={(index) => (
            <List.Item action={<button type="button">{`Open ${index}`}</button>}>
              {`File ${index}`}
            </List.Item>
          )}
        />,
      );
      const button = screen.getByRole('button', { name: 'Open 3' });
      await focus(button);
      await scrollTo(5000 * ITEM);
      expect(mountedIndexes()).toEqual([3, ...range(4994, 5017)]);
      expect(document.activeElement).toBe(button);
    });
  });

  describe('count changes under a scrolled window', () => {
    it('renders valid entries when count shrinks below the scroll position, and at 1 and 0', async () => {
      const { rerender } = render(<WindowedList navigationMode="items" />);
      await scrollTo(5000 * ITEM);
      // The kept index (5003) is past the new count: it is left out.
      await focus(item(5003));
      rerender(<WindowedList navigationMode="items" count={20} />);
      await act(async () => {});
      // The window is clamped the way a browser clamps scrollTop: the last 11 items in view.
      expect(order()).toEqual(['spacer', ...range(3, 20)]);
      expect(spacers()[0].style.height).toBe(`${3 * ITEM}px`);
      expect(items()[0]).toHaveAttribute('aria-setsize', '20');

      rerender(<WindowedList navigationMode="items" count={1} />);
      await act(async () => {});
      expect(order()).toEqual([0]);
      expect(items()[0]).toHaveAttribute('aria-setsize', '1');

      rerender(<WindowedList navigationMode="items" count={0} />);
      await act(async () => {});
      expect(listRoot().children).toHaveLength(0);
    });

    it('treats a count that is not a whole number of 0 or more as the whole part, or 0', () => {
      const { rerender } = render(<WindowedList count={2.7} />);
      expect(order()).toEqual([0, 1]);
      expect(items()[0]).toHaveAttribute('aria-setsize', '2');
      rerender(<WindowedList count={-3} />);
      expect(listRoot().children).toHaveLength(0);
      rerender(<WindowedList count={Number.NaN} />);
      expect(listRoot().children).toHaveLength(0);
    });
  });

  describe('keys move by index over the whole list', () => {
    it.each<[string, Partial<ListProps>, string]>([
      ['a listbox', { selectable: true }, 'aria-posinset'],
      ['a list navigated by its items', { navigationMode: 'items' }, 'aria-posinset'],
      ['a grid', { navigationMode: 'composite' }, 'aria-rowindex'],
    ])(
      'End focuses the last item of %s, scrolled into view, and Home the first',
      async (_, props, position) => {
        render(<WindowedList {...props} />);
        await focus(item(0));

        expect(await press('End')).toBe(false);
        const last = item(COUNT - 1);
        expect(document.activeElement).toBe(last);
        expect(last).toHaveAttribute(position, String(COUNT));
        expect(listRoot().scrollTop).toBe(MAX_SCROLL);
        // The window followed: item 0 is no longer kept.
        expect(mountedIndexes()).toEqual(range(9983, COUNT));
        expect(items().length).toBeLessThanOrEqual(40);
        // The focused item is the one Tab stop.
        expect(last).toHaveAttribute('tabindex', '0');
        expect(listRoot().querySelectorAll('[tabindex="0"]')).toHaveLength(1);

        expect(await press('Home')).toBe(false);
        expect(document.activeElement).toBe(item(0));
        expect(listRoot().scrollTop).toBe(0);
        expect(mountedIndexes()).toEqual(range(0, 17));
        expect(item(0)).toHaveAttribute('tabindex', '0');
      },
    );

    it('PageDown and PageUp move ten items, stopping at the ends', async () => {
      render(<WindowedList selectable />);
      await focus(item(0));
      // Item 10 is rendered: focused as it is (a browser scrolls a focused item into view).
      expect(await press('PageDown')).toBe(false);
      expect(document.activeElement).toBe(item(10));
      expect(listRoot().scrollTop).toBe(0);
      // Item 20 is not: scrolled to the bottom of the viewport, then focused.
      await press('PageDown');
      expect(document.activeElement).toBe(item(20));
      expect(item(20)).toHaveAttribute('aria-posinset', '21');
      expect(listRoot().scrollTop).toBe(21 * ITEM - VIEWPORT);
      await press('PageUp');
      expect(document.activeElement).toBe(item(10));

      await press('End');
      expect(await press('PageDown')).toBe(false);
      expect(document.activeElement).toBe(item(COUNT - 1));
      await press('PageUp');
      expect(document.activeElement).toBe(item(COUNT - 11));
      await press('Home');
      expect(await press('PageUp')).toBe(false);
      expect(document.activeElement).toBe(item(0));
    });

    it('ArrowDown on the last rendered item focuses the next index after scrolling it into view', async () => {
      render(<WindowedList selectable />);
      expect(mountedIndexes()).toEqual(range(0, 17));
      await focus(item(16));
      expect(await press('ArrowDown')).toBe(false);
      expect(document.activeElement).toBe(item(17));
      expect(item(17)).toHaveAttribute('aria-posinset', '18');
      expect(listRoot().scrollTop).toBe(18 * ITEM - VIEWPORT);
      expect(mountedIndexes()).toEqual(range(1, 24));
      await press('ArrowUp');
      expect(document.activeElement).toBe(item(16));
    });

    it('moves from an item kept outside the window to its index neighbour, not its DOM neighbour', async () => {
      render(<WindowedList selectable />);
      await focus(item(2));
      await scrollTo(5000 * ITEM);
      expect(order()).toEqual(['spacer', 2, 'spacer', ...range(4994, 5017), 'spacer']);
      await press('ArrowDown');
      expect(document.activeElement).toBe(item(3));
      expect(listRoot().scrollTop).toBe(3 * ITEM);

      await scrollTo(5000 * ITEM);
      await press('ArrowUp');
      expect(document.activeElement).toBe(item(2));
      expect(listRoot().scrollTop).toBe(2 * ITEM);
    });

    it('wraps the arrow keys around the ends of the whole list', async () => {
      render(<WindowedList navigationMode="items" />);
      await focus(item(0));
      await press('ArrowUp');
      expect(document.activeElement).toBe(item(COUNT - 1));
      expect(listRoot().scrollTop).toBe(MAX_SCROLL);
      await press('ArrowDown');
      expect(document.activeElement).toBe(item(0));
      expect(listRoot().scrollTop).toBe(0);
    });

    it('a grid moves its rows by index from a row or its action; the actions keep their mirrored keys (RTL)', async () => {
      renderWithProviders(<WindowedList navigationMode="composite" renderItem={actionItem} />, {
        dir: 'rtl',
      });
      await focus(item(0));
      await press('End');
      const last = item(COUNT - 1);
      expect(document.activeElement).toBe(last);
      expect(last).toHaveAttribute('aria-rowindex', String(COUNT));
      // Right to left: ArrowLeft moves into the row's action.
      await press('ArrowLeft');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open 9999' }));
      // From the action, ArrowUp goes to the row above by index.
      await press('ArrowUp');
      expect(document.activeElement).toBe(item(COUNT - 2));
      await press('Home');
      expect(document.activeElement).toBe(item(0));
      expect(listRoot().scrollTop).toBe(0);
    });

    it('leaves the keys alone in a list that does not navigate its items (navigationMode "none")', async () => {
      render(<WindowedList renderItem={actionItem} />);
      const button = screen.getByRole('button', { name: 'Open 3' });
      await focus(button);
      for (const key of ['End', 'Home', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp']) {
        expect(await press(key)).toBe(true);
        expect(document.activeElement).toBe(button);
      }
      expect(listRoot().scrollTop).toBe(0);
      expect(mountedIndexes()).toEqual(range(0, 17));
    });

    it('leaves the keys to a text field in an item', async () => {
      render(<WindowedList navigationMode="composite" renderItem={inputItem} />);
      const input = screen.getByRole('textbox', { name: 'Rename 3' });
      await focus(input);
      for (const key of ['ArrowDown', 'End', 'PageDown']) {
        expect(await press(key)).toBe(true);
        expect(document.activeElement).toBe(input);
      }
      expect(listRoot().scrollTop).toBe(0);
    });

    it('typeahead matches the labels of the rendered items only', async () => {
      render(<WindowedList selectable renderItem={zebraItem} />);
      await focus(item(0));
      // "Zebra" (the last item) is not rendered: nothing matches.
      await press('z');
      expect(document.activeElement).toBe(item(0));
      expect(listRoot().scrollTop).toBe(0);
      expect(mountedIndexes()).toEqual(range(0, 17));
      // Rendered, it matches.
      await scrollTo(MAX_SCROLL);
      expect(mountedIndexes()).toEqual([0, ...range(9983, COUNT)]);
      await press('z');
      expect(document.activeElement).toBe(option('Zebra'));
    });

    it('a key that targets the focused item drops an awaited item and shows the focused one', async () => {
      render(<WindowedList selectable />);
      await focus(item(10));
      // Both keys before the list renders again (one task): the second moves from the awaited
      // item 20 back to item 10, which has focus.
      act(() => {
        fireEvent.keyDown(item(10), { key: 'PageDown' });
        fireEvent.keyDown(item(10), { key: 'PageUp' });
      });
      await act(async () => {});
      expect(document.activeElement).toBe(item(10));
      expect(listRoot().scrollTop).toBe(10 * ITEM);
    });

    it('a key pressed while an item is awaited moves from that item (the latest target wins)', async () => {
      render(<WindowedList selectable />);
      await focus(item(0));
      act(() => {
        fireEvent.keyDown(item(0), { key: 'End' });
        fireEvent.keyDown(item(0), { key: 'ArrowUp' });
      });
      await act(async () => {});
      expect(document.activeElement).toBe(item(COUNT - 2));
      expect(mountedIndexes()).toEqual(range(9983, COUNT));
    });

    it('keeps the awaited item rendered when the window does not scroll to it, and focuses it', async () => {
      const scrollToIndex = vi.fn();
      /** A window whose `scrollToIndex` moves nothing (a smooth scroll, or an adapter's). */
      function StillWindowList() {
        const virtualWindow = useVirtualWindow({ itemSize: ITEM });
        const still = React.useMemo<VirtualWindow>(
          () => ({ ...virtualWindow, scrollToIndex }),
          [virtualWindow],
        );
        return (
          <List aria-label="Files" selectable virtualWindow={still} count={COUNT}>
            {fileItem}
          </List>
        );
      }
      render(<StillWindowList />);
      await focus(item(0));
      await press('End');
      expect(scrollToIndex).toHaveBeenCalledTimes(1);
      expect(scrollToIndex).toHaveBeenCalledWith(COUNT - 1, { align: 'auto' });
      expect(document.activeElement).toBe(item(COUNT - 1));
      expect(order()).toEqual([...range(0, 17), 'spacer', COUNT - 1]);
    });

    it('drops an awaited item that count no longer holds, so it is never focused later', async () => {
      const { rerender } = render(<WindowedList selectable />);
      await focus(item(0));
      act(() => {
        fireEvent.keyDown(item(0), { key: 'End' });
        rerender(<WindowedList selectable count={20} />);
      });
      await act(async () => {});
      expect(document.activeElement).toBe(item(0));
      rerender(<WindowedList selectable />);
      await act(async () => {});
      expect(mountedIndexes()).toContain(COUNT - 1);
      expect(document.activeElement).toBe(item(0));
    });

    it('focuses the awaited item once in StrictMode', async () => {
      render(
        <React.StrictMode>
          <WindowedList selectable />
        </React.StrictMode>,
      );
      await focus(item(0));
      await press('End');
      expect(document.activeElement).toBe(item(COUNT - 1));
      await press('Home');
      expect(document.activeElement).toBe(item(0));
      expect(mountedIndexes()).toEqual(range(0, 17));
    });
  });

  describe('the focused item and the Tab stop', () => {
    it('makes the focused item of a selectable list its Tab stop while focus is in the list', async () => {
      render(
        <>
          <WindowedList selectable defaultSelectedItems={['file-1']} />
          <button type="button">After</button>
        </>,
      );
      await scrollTo(5000 * ITEM);
      await focus(item(5000));
      await scrollTo(0);
      expect(order()).toEqual([...range(0, 17), 'spacer', 5000, 'spacer']);
      expect(item(5000)).toHaveAttribute('tabindex', '0');
      expect(item(1)).toHaveAttribute('tabindex', '-1');
      expect(listRoot().querySelectorAll('[tabindex="0"]')).toHaveLength(1);

      // Focus leaves: the item is no longer kept, and the selected item is the Tab stop again.
      await focus(screen.getByRole('button', { name: 'After' }));
      expect(mountedIndexes()).toEqual(range(0, 17));
      expect(item(1)).toHaveAttribute('tabindex', '0');
    });

    it('stops keeping an item scrolled away once focus leaves the list', async () => {
      render(
        <>
          <WindowedList selectable />
          <button type="button">After</button>
        </>,
      );
      await focus(item(2));
      await scrollTo(5000 * ITEM);
      expect(order()).toEqual(['spacer', 2, 'spacer', ...range(4994, 5017), 'spacer']);
      await focus(screen.getByRole('button', { name: 'After' }));
      expect(order()).toEqual(['spacer', ...range(4994, 5017), 'spacer']);
      // Nothing selected and nothing focused: the first rendered item is the Tab stop.
      expect(item(4994)).toHaveAttribute('tabindex', '0');
      expect(listRoot().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    });

    it('keeps the item while focus is in a popup it opened (a portal), until focus leaves both', async () => {
      render(
        <>
          <WindowedList renderItem={popupItem} />
          <button type="button">After</button>
        </>,
      );
      await focus(screen.getByRole('button', { name: 'Open 3' }));
      await focus(screen.getByRole('button', { name: 'Menu 3' }));
      await scrollTo(5000 * ITEM);
      expect(mountedIndexes()).toEqual([3, ...range(4994, 5017)]);
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menu 3' }));

      await focus(screen.getByRole('button', { name: 'After' }));
      expect(mountedIndexes()).toEqual(range(4994, 5017));
      expect(screen.queryByRole('button', { name: 'Menu 3' })).toBeNull();
    });

    it('moves focus and the Tab stop to the last item when count drops below the focused one', async () => {
      const { rerender } = render(<WindowedList selectable />);
      await scrollTo(5000 * ITEM);
      await focus(item(5003));
      rerender(<WindowedList selectable count={20} />);
      await act(async () => {});
      expect(order()).toEqual(['spacer', ...range(3, 20)]);
      expect(document.activeElement).toBe(item(19));
      expect(item(19)).toHaveAttribute('aria-posinset', '20');
      expect(item(19)).toHaveAttribute('tabindex', '0');
      expect(listRoot().querySelectorAll('[tabindex="0"]')).toHaveLength(1);

      // No item left: nothing to focus, and nothing throws.
      rerender(<WindowedList selectable count={0} />);
      await act(async () => {});
      expect(listRoot().children).toHaveLength(0);
      expect(document.activeElement).toBe(document.body);
      // The items come back without a stale kept item.
      rerender(<WindowedList selectable />);
      await act(async () => {});
      expect(order()).toEqual(['spacer', ...range(4994, 5017), 'spacer']);
    });

    it('restores focus by the item’s index after a switch to grid semantics', async () => {
      const { rerender } = render(
        <WindowedList navigationMode="items" renderItem={unvaluedItem} />,
      );
      await scrollTo(5000 * ITEM);
      await focus(item(5000));
      // The switch remounts the items; the same commit moves the window (count 5005 puts its first
      // item at 4988), so the item at the same DOM position is another one.
      rerender(<WindowedList navigationMode="composite" count={5005} renderItem={unvaluedItem} />);
      await act(async () => {});
      const focused = document.activeElement as HTMLElement;
      expect(focused).toHaveAttribute('role', 'row');
      expect(focused).toHaveAttribute('data-index', '5000');
      expect(focused).toHaveAttribute('aria-rowindex', '5001');
    });
  });

  describe('server render', () => {
    it('renders the first window only on the server', () => {
      const html = renderToString(
        <WindowedList selectable selectionMode="multiple" defaultSelectedItems={['file-3']} />,
      );
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const options = Array.from(parsed.querySelectorAll('[role="option"]'));
      expect(options.map((el) => el.getAttribute('data-index'))).toEqual(range(0, 17).map(String));
      // A parsed document has no window, which jest-dom's matchers need.
      expect(options[3].getAttribute('aria-selected')).toBe('true');
      expect(options[0].getAttribute('aria-setsize')).toBe(String(COUNT));
      const serverSpacers = parsed.querySelectorAll('[data-virtual-spacer]');
      expect(serverSpacers).toHaveLength(1);
      expect(serverSpacers[0].getAttribute('style')).toContain(`${(COUNT - 17) * ITEM}px`);
    });

    it('hydrates the server window without a mismatch', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const ui = (
        <WindowedList selectable selectionMode="multiple" defaultSelectedItems={['file-3']} />
      );
      const container = document.createElement('div');
      container.innerHTML = renderToString(ui);
      document.body.appendChild(container);
      let root: Root | undefined;
      try {
        act(() => {
          root = hydrateRoot(container, ui);
        });
        await act(async () => {});
        expect(mountedIndexes()).toEqual(range(0, 17));
        expect(option('File 3')).toHaveAttribute('aria-selected', 'true');
        expect(error).not.toHaveBeenCalled();
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });
  });

  describe('the structure does not depend on the rendered items', () => {
    it('keeps the root element, its scroll position and its role when items with actions scroll in and out', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<WindowedList selectable renderItem={laterActionItem} />);
      const root = listRoot();
      expect(root).toHaveAttribute('role', 'listbox');
      expect(warn).not.toHaveBeenCalled();

      await scrollTo(200 * ITEM);
      expect(listRoot()).toBe(root);
      expect(listRoot().scrollTop).toBe(200 * ITEM);
      expect(root).toHaveAttribute('role', 'listbox');
      expect(mountedIndexes()).toEqual(range(194, 217));
      expect(item(200)).toHaveAttribute('role', 'option');
      expect(item(200)).toHaveAttribute('aria-posinset', '201');

      await scrollTo(0);
      expect(listRoot()).toBe(root);
      expect(root).toHaveAttribute('role', 'listbox');
      await scrollTo(300 * ITEM);
      expect(listRoot()).toBe(root);
      expect(messages(warn)).toEqual([ACTIONS_WARNING]);
    });

    it('stays a listbox from the first render, on the server too, when every item has an action', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const html = renderToString(<WindowedList selectable renderItem={actionItem} />);
      expect(html).toContain('role="listbox"');
      expect(html).not.toContain('role="grid"');
      render(<WindowedList selectable renderItem={actionItem} />);
      expect(listRoot()).toHaveAttribute('role', 'listbox');
      expect(screen.getAllByRole('option')).toHaveLength(17);
      expect(messages(warn)).toEqual([ACTIONS_WARNING]);
    });

    it('navigationMode="composite" holds the grid from the first render whatever is scrolled, without a warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<WindowedList selectable navigationMode="composite" renderItem={laterActionItem} />);
      const root = listRoot();
      expect(screen.getByRole('grid', { name: 'Files' })).toBe(root);
      await scrollTo(200 * ITEM);
      expect(listRoot()).toBe(root);
      expect(listRoot().scrollTop).toBe(200 * ITEM);
      expect(screen.getByRole('grid', { name: 'Files' })).toBe(root);
      expect(screen.getByRole('button', { name: 'Open 200' })).toHaveAttribute('tabindex', '-1');
      await scrollTo(0);
      expect(screen.getByRole('grid', { name: 'Files' })).toBe(root);
      expect(warn).not.toHaveBeenCalled();
    });

    it('does not warn for actions in a plain windowed list, whose items are list items', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<WindowedList renderItem={actionItem} />);
      expect(listRoot()).toHaveAttribute('role', 'list');
      await scrollTo(200 * ITEM);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('development warnings', () => {
    it('warns once and renders every element child when a window gets element children', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function ElementChildren() {
        const virtualWindow = useVirtualWindow({ itemSize: ITEM });
        return (
          <List aria-label="Files" virtualWindow={virtualWindow} count={100}>
            <List.Item>Apple</List.Item>
            <List.Item>Banana</List.Item>
          </List>
        );
      }
      const { rerender } = render(<ElementChildren />);
      rerender(<ElementChildren />);
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
      expect(screen.getAllByRole('listitem')[0]).not.toHaveAttribute('data-index');
      expect(document.querySelector('[data-virtual-spacer]')).toBeNull();
      expect(messages(warn)).toEqual([CHILDREN_WARNING]);
    });

    it.each<[string, Partial<ListProps>]>([
      ['without virtualWindow or count', {}],
      ['with count but no virtualWindow', { count: 10 }],
    ])('warns once and renders nothing for a function child %s', (_, props) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <List aria-label="Files" {...props}>
          {fileItem}
        </List>,
      );
      expect(screen.getByRole('list')).toBeEmptyDOMElement();
      expect(messages(warn)).toEqual([CHILDREN_WARNING]);
    });

    it('warns once for a window without count, and ignores it', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function NoCount() {
        const virtualWindow = useVirtualWindow({ itemSize: ITEM });
        return (
          <List aria-label="Files" virtualWindow={virtualWindow}>
            {fileItem}
          </List>
        );
      }
      render(<NoCount />);
      expect(screen.getByRole('list')).toBeEmptyDOMElement();
      expect(messages(warn)).toEqual([CHILDREN_WARNING]);
    });

    it('does not warn for a windowed list or a list with element children', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <WindowedList />
          <List aria-label="Fruits">
            <List.Item>Apple</List.Item>
          </List>
        </>,
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('registry order', () => {
    it('orders records by their index, without reading the DOM (spacers and wrappers do not matter)', () => {
      const registry = new ListRegistry();
      registry.setActive(true);
      const record = (value: string, index: number) => ({
        value,
        hasAction: false,
        element: { current: null },
        index,
      });
      registry.set({}, record('c', 2));
      registry.set({}, record('a', 0));
      registry.set({}, record('b', 1));
      expect(registry.getSnapshot()?.values).toEqual(['c', 'a', 'b']);
      registry.syncOrder(document.createElement('ul'));
      expect(registry.getSnapshot()?.values).toEqual(['a', 'b', 'c']);
    });
  });

  it('types: virtualWindow, count and a function child', () => {
    expectTypeOf<ListProps['virtualWindow']>().toEqualTypeOf<VirtualWindow | undefined>();
    expectTypeOf<ListProps['count']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<(index: number) => React.ReactNode>().toMatchTypeOf<
      NonNullable<ListProps['children']>
    >();
    expectTypeOf<React.ReactNode>().toMatchTypeOf<ListProps['children']>();
  });
});
