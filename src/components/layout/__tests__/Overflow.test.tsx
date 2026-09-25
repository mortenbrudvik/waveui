import * as React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import {
  Overflow,
  OverflowItem,
  useIsOverflowing,
  useIsOverflowItemVisible,
  useOverflowMenu,
} from '../Overflow';
import type { OverflowItemProps, OverflowProps, UseOverflowMenuResult } from '../Overflow';
import {
  installResizeObserverMock,
  testCompoundExposure,
  testSystemProps,
  expectThrows,
} from '../../../test-utils';
import type { ResizeObserverMock } from '../../../test-utils';

// ---------------------------------------------------------------------------
// Layout stubs. jsdom has no layout (every width is 0), so each test states the widths it needs.
// Widths are looked up by `data-testid`; the overflow button wrapper (`data-overflow-button`) uses
// the key `button`. Like a browser, an element hidden with `display: none` (an item carrying
// `data-overflow-hidden`) reports 0, so hidden items must be measured from a cache.
// ---------------------------------------------------------------------------

type Widths = Record<string, number>;

interface LayoutStub {
  widths: Widths;
  scrollWidths: Widths;
  restore(): void;
}

function keyOf(el: Element): string | null {
  if (el.hasAttribute('data-overflow-button')) return 'button';
  return el.getAttribute('data-testid');
}

function stubLayout(widths: Widths, scrollWidths: Widths = {}): LayoutStub {
  const stub: LayoutStub = { widths, scrollWidths, restore: () => {} };
  const targets: Array<[object, string]> = [
    [HTMLElement.prototype, 'offsetWidth'],
    [Element.prototype, 'clientWidth'],
    [Element.prototype, 'scrollWidth'],
  ];
  const saved = targets.map(([proto, name]) => Object.getOwnPropertyDescriptor(proto, name));
  const width = (el: Element): number => {
    if (el.hasAttribute('data-overflow-hidden')) return 0;
    const key = keyOf(el);
    return key !== null && key in stub.widths ? stub.widths[key] : 0;
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return width(this);
    },
  });
  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    get(this: Element) {
      return width(this);
    },
  });
  Object.defineProperty(Element.prototype, 'scrollWidth', {
    configurable: true,
    get(this: Element) {
      const key = keyOf(this);
      return key !== null && key in stub.scrollWidths ? stub.scrollWidths[key] : width(this);
    },
  });
  stub.restore = () => {
    targets.forEach(([proto, name], i) => {
      const descriptor = saved[i];
      if (descriptor) Object.defineProperty(proto, name, descriptor);
      else Reflect.deleteProperty(proto, name);
    });
  };
  return stub;
}

let layout: LayoutStub | null = null;
let ro: ResizeObserverMock | null = null;

afterEach(() => {
  layout?.restore();
  layout = null;
  ro?.restore();
  ro = null;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function layoutWith(widths: Widths, scrollWidths?: Widths): LayoutStub {
  layout = stubLayout(widths, scrollWidths);
  return layout;
}

function withResizeObserver(): ResizeObserverMock {
  ro = installResizeObserverMock();
  return ro;
}

const moreButton = (count: number) => <button type="button">+{count}</button>;

function ThreeItems(props: Partial<React.ComponentProps<typeof Overflow>>) {
  return (
    <Overflow data-testid="overflow" {...props}>
      <OverflowItem itemId="a" data-testid="item-a">
        A
      </OverflowItem>
      <OverflowItem itemId="b" data-testid="item-b">
        B
      </OverflowItem>
      <OverflowItem itemId="c" data-testid="item-c">
        C
      </OverflowItem>
    </Overflow>
  );
}

function hiddenItems(): string[] {
  return ['a', 'b', 'c', 'd'].filter((id) =>
    screen.queryByTestId(`item-${id}`)?.hasAttribute('aria-hidden'),
  );
}

// ---------------------------------------------------------------------------

describe('Overflow', () => {
  describe('system props', () => {
    // Items overflow a narrow container, so the a11y variant audits hidden items and the button.
    beforeEach(() => {
      layoutWith({ overflow: 60, 'item-a': 40, 'item-b': 40, button: 20 });
    });

    testSystemProps(Overflow, {
      expectedTag: 'div',
      displayName: 'Overflow',
      defaultProps: {
        children: (
          <>
            <OverflowItem itemId="a" data-testid="item-a">
              <button type="button">Alpha</button>
            </OverflowItem>
            <OverflowItem itemId="b" data-testid="item-b">
              <button type="button">Beta</button>
            </OverflowItem>
          </>
        ),
      },
      a11yVariants: [
        {
          name: 'hidden items with an overflow button',
          props: { overflowButton: (count) => <button type="button">{count} more</button> },
        },
      ],
    });
  });

  testCompoundExposure(Overflow, ['Item']);

  it('exports the flat sub-component name (C-COMPOUND)', () => {
    expect(OverflowItem).toBe(Overflow.Item);
  });

  it('types ref in its exported props and the overflow menu API (C-REF, layout#4)', () => {
    expectTypeOf<OverflowProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<OverflowItemProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<OverflowProps['overflowButton']>().toEqualTypeOf<
      ((count: number, hiddenIds: string[]) => React.ReactNode) | undefined
    >();
    expectTypeOf(useOverflowMenu).returns.toEqualTypeOf<UseOverflowMenuResult>();
    expectTypeOf<UseOverflowMenuResult>().toEqualTypeOf<{ hiddenIds: string[]; count: number }>();
    expectTypeOf(useIsOverflowItemVisible).parameters.toEqualTypeOf<[itemId: string]>();
    expectTypeOf(useIsOverflowItemVisible).returns.toEqualTypeOf<boolean>();
  });

  it('renders every item and no overflow button when the items fit exactly', () => {
    const renderButton = vi.fn(moreButton);
    layoutWith({ overflow: 120, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
    render(<ThreeItems overflowButton={renderButton} />);

    expect(hiddenItems()).toEqual([]);
    for (const id of ['a', 'b', 'c']) {
      expect(screen.getByTestId(`item-${id}`)).not.toHaveAttribute('data-overflow-hidden');
    }
    expect(screen.queryByRole('button')).toBeNull();
    expect(renderButton).not.toHaveBeenCalled();
  });

  it('hides the trailing items, reserving the measured width of the overflow button', () => {
    const renderButton = vi.fn(moreButton);
    layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
    render(<ThreeItems overflowButton={renderButton} />);

    // 120 > 100: overflow. With the 30px button, only A (40) fits in 70.
    expect(hiddenItems()).toEqual(['b', 'c']);
    expect(screen.getByTestId('item-b')).toHaveAttribute('data-overflow-hidden');
    expect(screen.getByTestId('item-a')).not.toHaveAttribute('data-overflow-hidden');
    expect(screen.getByRole('button', { name: '+2' })).toBeInTheDocument();
    expect(renderButton).toHaveBeenLastCalledWith(2, ['b', 'c']);
  });

  it('never hides the first item, even when it is wider than the container', () => {
    layoutWith({ overflow: 30, 'item-a': 50, 'item-b': 40, 'item-c': 40, button: 20 });
    render(<ThreeItems overflowButton={moreButton} />);

    expect(hiddenItems()).toEqual(['b', 'c']);
    // jsdom has no layout: the classes are the contract. The button stays in the row's flow (it
    // adds to the row height and follows justify-*) and sticks to the inline end, so the wide first
    // item cannot push it out of the clipped row. It covers the end of that item, so it is marked
    // (C-CLASS) and gets a backing.
    const wrapper = screen.getByRole('button', { name: '+2' }).parentElement!;
    expect(wrapper).toHaveAttribute('data-overflow-button');
    // It sticks at the row's clipping edge, past the row's padding (-end-1 offsets p-1), and
    // keeps room inside for its own focus indicator while pinned.
    expect(wrapper).toHaveClass(
      'sticky',
      '-end-1',
      'shrink-0',
      'data-[overflow-pinned]:bg-background',
      'data-[overflow-pinned]:pe-1',
    );
    expect(wrapper).not.toHaveClass('absolute');
    expect(wrapper).toHaveAttribute('data-overflow-pinned');
  });

  it('leaves room inside its clipping for the focus indicators of its items, within its own box', () => {
    layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
    render(<ThreeItems overflowButton={moreButton} className="gap-1" />);
    // jsdom has no layout: the classes are the contract. A 4px padding inside the clipping edge, so
    // a ring drawn 4px outside an item (focusRing: 2px offset + 2px width) stays inside the clipped
    // box on every side.
    const row = screen.getByTestId('overflow');
    expect(row).toHaveClass('flex', 'overflow-hidden', 'p-1', 'gap-1');
    // No negative margin: it would make the row's box reach past its container, which a scroll
    // container around an edge-to-edge row (or the page) counts as overflow and scrolls by 4px.
    expect(row.className).not.toMatch(/(^|\s)-m[xysetblr]?-/);
  });

  it('measures the room for the items without the row padding', () => {
    const renderButton = vi.fn(moreButton);
    // clientWidth includes the padding: 110 - 2 × 5 leaves exactly the 100 the items need.
    const stub = layoutWith({
      overflow: 110,
      'item-a': 40,
      'item-b': 30,
      'item-c': 30,
      button: 30,
    });
    const { unmount } = render(
      <ThreeItems overflowButton={renderButton} style={{ padding: '0 5px' }} />,
    );
    expect(hiddenItems()).toEqual([]);
    unmount();
    stub.widths.overflow = 108;
    render(<ThreeItems overflowButton={renderButton} style={{ padding: '0 5px' }} />);
    // 98 < 100 overflows; the button (30) leaves 68, where A and B (70 together) no longer fit.
    expect(hiddenItems()).toEqual(['b', 'c']);
    expect(renderButton).toHaveBeenLastCalledWith(2, ['b', 'c']);
  });

  it('marks the button pinned only while the first item is wider than the room beside it', () => {
    const resize = withResizeObserver();
    const stub = layoutWith({
      overflow: 100,
      'item-a': 40,
      'item-b': 40,
      'item-c': 40,
      button: 30,
    });
    render(<ThreeItems overflowButton={moreButton} />);
    const wrapper = () => screen.getByRole('button', { name: '+2' }).parentElement!;
    // A (40) fits in the 70 left beside the 30px button: the button covers nothing.
    expect(hiddenItems()).toEqual(['b', 'c']);
    expect(wrapper()).not.toHaveAttribute('data-overflow-pinned');

    // Same hidden items, but A (90) no longer fits beside the button.
    stub.widths['item-a'] = 90;
    resize.trigger(screen.getByTestId('item-a'));
    expect(hiddenItems()).toEqual(['b', 'c']);
    expect(wrapper()).toHaveAttribute('data-overflow-pinned');

    stub.widths['item-a'] = 40;
    resize.trigger(screen.getByTestId('item-a'));
    expect(wrapper()).not.toHaveAttribute('data-overflow-pinned');
  });

  it('keeps the hidden ids (same array) when only the pinned state changes', () => {
    const resize = withResizeObserver();
    const stub = layoutWith({
      overflow: 100,
      'item-a': 40,
      'item-b': 40,
      'item-c': 40,
      button: 30,
    });
    const seen: string[][] = [];
    render(
      <ThreeItems
        overflowButton={(count, hiddenIds) => {
          seen.push(hiddenIds);
          return moreButton(count);
        }}
      />,
    );
    const before = seen[seen.length - 1];
    stub.widths['item-a'] = 90;
    resize.trigger(screen.getByTestId('item-a'));
    expect(screen.getByRole('button', { name: '+2' }).parentElement).toHaveAttribute(
      'data-overflow-pinned',
    );
    expect(seen[seen.length - 1]).toBe(before);
  });

  it('does not mark the button pinned when only the gap before it has to shrink', () => {
    layoutWith({ overflow: 100, 'item-a': 60, 'item-b': 40, button: 40 });
    render(
      <Overflow data-testid="overflow" overflowButton={moreButton} style={{ columnGap: '10px' }}>
        <OverflowItem itemId="a" data-testid="item-a">
          A
        </OverflowItem>
        <OverflowItem itemId="b" data-testid="item-b">
          B
        </OverflowItem>
      </Overflow>,
    );
    // A (60) and the button (40) fill the 100 exactly: the sticky button only eats the 10px gap.
    expect(hiddenItems()).toEqual(['b']);
    const wrapper = screen.getByRole('button', { name: '+1' }).parentElement!;
    expect(wrapper).not.toHaveAttribute('data-overflow-pinned');
  });

  it('counts the flex gap between items and before the button', () => {
    const renderButton = vi.fn(moreButton);
    layoutWith({ overflow: 100, 'item-a': 30, 'item-b': 30, 'item-c': 30, button: 20 });
    render(<ThreeItems overflowButton={renderButton} style={{ columnGap: '10px' }} />);
    // 30 + 10 + 30 + 10 + 30 = 110 > 100. Reserve 20 + 10: A (30) and B (70) fit in 70.
    expect(hiddenItems()).toEqual(['c']);
    expect(renderButton).toHaveBeenLastCalledWith(1, ['c']);
  });

  it('measures and observes correctly in StrictMode', () => {
    const resize = withResizeObserver();
    const stub = layoutWith({
      overflow: 100,
      'item-a': 40,
      'item-b': 40,
      'item-c': 40,
      button: 30,
    });
    render(
      <React.StrictMode>
        <ThreeItems overflowButton={moreButton} />
      </React.StrictMode>,
    );
    expect(hiddenItems()).toEqual(['b', 'c']);

    stub.widths.overflow = 200;
    resize.trigger(screen.getByTestId('overflow'));
    expect(hiddenItems()).toEqual([]);
  });

  it('shows hidden items again when the container grows (widths cached while visible)', () => {
    const resize = withResizeObserver();
    const stub = layoutWith({
      overflow: 100,
      'item-a': 40,
      'item-b': 40,
      'item-c': 40,
      button: 30,
    });
    render(<ThreeItems overflowButton={moreButton} />);
    expect(hiddenItems()).toEqual(['b', 'c']);

    // Hidden items now report 0 (display: none); the cached widths are used.
    stub.widths.overflow = 120;
    resize.trigger(screen.getByTestId('overflow'));
    expect(hiddenItems()).toEqual([]);
    expect(screen.queryByRole('button')).toBeNull();

    stub.widths.overflow = 90;
    resize.trigger(screen.getByTestId('overflow'));
    expect(hiddenItems()).toEqual(['b', 'c']);
  });

  it('hides the overflowing items within the mounting commit, before the browser can paint (layout#1)', () => {
    layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
    const commits: Array<{ phase: string; hidden: string[] }> = [];
    render(
      <React.Profiler
        id="overflow"
        onRender={(_id, phase) =>
          commits.push({
            phase,
            hidden: Array.from(document.querySelectorAll('[data-overflow-hidden]')).map(
              (el) => el.getAttribute('data-testid') ?? '',
            ),
          })
        }
      >
        <ThreeItems overflowButton={moreButton} />
      </React.Profiler>,
    );
    // The first commit shows every item (measuring needs the layout). Every later commit is a
    // nested update: scheduled from the layout phase of the previous commit and flushed
    // synchronously in the same task, so no frame is painted with every item visible. (An update
    // from a passive effect reports 'update' and can render after a paint.) The second commit
    // hides C and mounts the button; the third reserves the button's measured width and hides B.
    expect(commits[0]).toEqual({ phase: 'mount', hidden: [] });
    expect(commits.slice(1).map((commit) => commit.phase)).toEqual(
      commits.slice(1).map(() => 'nested-update'),
    );
    expect(commits.length).toBeGreaterThan(1);
    expect(commits[1].hidden).toContain('item-c');
    expect(commits.at(-1)?.hidden).toEqual(['item-b', 'item-c']);
  });

  it('hands consumers mutable hidden-id arrays that do not leak into the store (layout#4)', () => {
    const resize = withResizeObserver();
    const stub = layoutWith({
      overflow: 100,
      'item-a': 40,
      'item-b': 40,
      'item-c': 40,
      button: 30,
    });
    const received: string[][] = [];
    const menus: string[][] = [];
    function MoreMenu({ ids }: { ids: string[] }) {
      const menu = useOverflowMenu();
      menus.push([...menu.hiddenIds]);
      // In-place sort of the hook's array: type-correct on string[], so it must not throw.
      menu.hiddenIds.sort();
      return <button type="button">{ids.join(',')}</button>;
    }
    render(
      <ThreeItems
        overflowButton={(_count, hiddenIds) => {
          expect(Object.isFrozen(hiddenIds)).toBe(false);
          received.push([...hiddenIds]);
          // In-place descending sort (0.5-rc threw "Cannot assign to read only property").
          hiddenIds.sort((a, b) => b.localeCompare(a));
          return <MoreMenu ids={[...hiddenIds]} />;
        }}
      />,
    );
    expect(received.at(-1)).toEqual(['b', 'c']);
    expect(screen.getByRole('button', { name: 'c,b' })).toBeInTheDocument();
    // The overflowButton's in-place sort did not reach useOverflowMenu (DOM order kept).
    expect(menus.at(-1)).toEqual(['b', 'c']);

    // Nor the store: a resize that hides the same items renders nothing, and a resize that changes
    // the set publishes DOM order again.
    const renders = received.length;
    stub.widths.overflow = 95;
    resize.trigger(screen.getByTestId('overflow'));
    expect(received).toHaveLength(renders);
    expect(hiddenItems()).toEqual(['b', 'c']);
    stub.widths.overflow = 120;
    resize.trigger(screen.getByTestId('overflow'));
    expect(hiddenItems()).toEqual([]);
    stub.widths.overflow = 100;
    resize.trigger(screen.getByTestId('overflow'));
    expect(received.at(-1)).toEqual(['b', 'c']);
    expect(menus.at(-1)).toEqual(['b', 'c']);
  });

  it('never writes measurement styles onto items, so hidden items stay hidden (layout#1)', () => {
    const resize = withResizeObserver();
    layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
    render(
      <Overflow data-testid="overflow" overflowButton={moreButton}>
        <OverflowItem itemId="a" data-testid="item-a" style={{ opacity: 0.5 }}>
          A
        </OverflowItem>
        <OverflowItem itemId="b" data-testid="item-b" style={{ opacity: 0.5 }}>
          B
        </OverflowItem>
        <OverflowItem itemId="c" data-testid="item-c" style={{ opacity: 0.5 }}>
          C
        </OverflowItem>
      </Overflow>,
    );

    for (let i = 0; i < 3; i++) resize.trigger(screen.getByTestId('overflow'));

    expect(hiddenItems()).toEqual(['b', 'c']);
    // Only the consumer's style, plus the `display: none` React renders on a hidden item: no
    // visibility/position/size written by a measurement pass.
    expect(screen.getByTestId('item-a').getAttribute('style')).toBe('opacity: 0.5;');
    for (const id of ['b', 'c']) {
      expect(screen.getByTestId(`item-${id}`).getAttribute('style')).toBe(
        'opacity: 0.5; display: none;',
      );
    }
    expect(screen.getByTestId('item-c')).toHaveAttribute('data-overflow-hidden');
  });

  it('hides an item with an inline display: none that consumer styles and classes cannot override', () => {
    const resize = withResizeObserver();
    const stub = layoutWith({ overflow: 70, 'item-a': 40, 'item-b': 40, button: 30 });
    render(
      <Overflow data-testid="overflow" overflowButton={moreButton}>
        <OverflowItem
          itemId="a"
          data-testid="item-a"
          className="flex"
          style={{ display: 'flex', opacity: 0.5 }}
        >
          A
        </OverflowItem>
        <OverflowItem
          itemId="b"
          data-testid="item-b"
          className="flex"
          style={{ display: 'flex', opacity: 0.5 }}
        >
          B
        </OverflowItem>
      </Overflow>,
    );
    // 80 > 70 overflows; with the 30px button reserved only A (40) fits, so B is hidden.
    expect(hiddenItems()).toEqual(['b']);
    const hidden = screen.getByTestId('item-b');
    expect(hidden).toHaveAttribute('data-overflow-hidden');
    // An inline `display: none` placed after the consumer's own style: it beats the consumer's
    // inline `display` and any display utility in any cascade layer (a prefixed-Tailwind app's
    // `tw:flex` layered above Wave's styles included), so a hidden item is never shown while it is
    // aria-hidden, inert and counted in "+N". The consumer's class and other styles stay.
    expect(hidden.style.display).toBe('none');
    expect(hidden.style.opacity).toBe('0.5');
    expect(window.getComputedStyle(hidden).display).toBe('none');
    expect(hidden).toHaveClass('flex');
    const visible = screen.getByTestId('item-a');
    expect(visible).not.toHaveAttribute('data-overflow-hidden');
    expect(visible.style.display).toBe('flex');

    // Shown again: the consumer's display comes back.
    stub.widths.overflow = 200;
    resize.trigger(screen.getByTestId('overflow'));
    expect(hiddenItems()).toEqual([]);
    expect(hidden.style.display).toBe('flex');
    expect(hidden).not.toHaveAttribute('data-overflow-hidden');
  });

  it('decides in DOM order, also for an item that mounts later but renders first (layout#3)', () => {
    const renderButton = vi.fn(moreButton);
    layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
    const { rerender } = render(
      <Overflow data-testid="overflow" overflowButton={renderButton}>
        {[
          <OverflowItem key="b" itemId="b" data-testid="item-b">
            B
          </OverflowItem>,
          <OverflowItem key="c" itemId="c" data-testid="item-c">
            C
          </OverflowItem>,
        ]}
      </Overflow>,
    );
    expect(hiddenItems()).toEqual([]);

    rerender(
      <Overflow data-testid="overflow" overflowButton={renderButton}>
        {[
          <OverflowItem key="a" itemId="a" data-testid="item-a">
            A
          </OverflowItem>,
          <OverflowItem key="b" itemId="b" data-testid="item-b">
            B
          </OverflowItem>,
          <OverflowItem key="c" itemId="c" data-testid="item-c">
            C
          </OverflowItem>,
        ]}
      </Overflow>,
    );

    expect(hiddenItems()).toEqual(['b', 'c']);
    expect(renderButton).toHaveBeenLastCalledWith(2, ['b', 'c']);
  });

  function domItemOrder(): string[] {
    return Array.from(
      screen.getByTestId('overflow').querySelectorAll('[data-testid^="item-"]'),
      (el) => el.getAttribute('data-testid') ?? '',
    );
  }

  it('re-measures when mounted items are reordered without any size change (layout#3)', () => {
    // A real ResizeObserver would not fire: no size changes, nothing registers again.
    withResizeObserver();
    const renderButton = vi.fn(moreButton);
    layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
    const row = (order: string[]) => (
      <Overflow data-testid="overflow" overflowButton={renderButton}>
        {order.map((id) => (
          <OverflowItem key={id} itemId={id} data-testid={`item-${id}`}>
            {id.toUpperCase()}
          </OverflowItem>
        ))}
      </Overflow>
    );
    const { rerender } = render(row(['a', 'b', 'c']));
    expect(hiddenItems()).toEqual(['b', 'c']);

    rerender(row(['c', 'a', 'b']));
    expect(domItemOrder()).toEqual(['item-c', 'item-a', 'item-b']);
    // The first DOM item (C) stays; the trailing ones (A, B) hide, and the menu lists them.
    expect(screen.getByTestId('item-c')).not.toHaveAttribute('data-overflow-hidden');
    expect(hiddenItems()).toEqual(['a', 'b']);
    expect(renderButton).toHaveBeenLastCalledWith(2, ['a', 'b']);
  });

  it('re-measures when a child component reorders items without rendering the Overflow (layout#3)', async () => {
    withResizeObserver();
    const renderButton = vi.fn(moreButton);
    layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
    const reorder = React.createRef<(order: string[]) => void>();
    // The list owns its order: reordering renders neither the Overflow nor the (unchanged) items.
    function Items({ api }: { api: React.Ref<(order: string[]) => void> }) {
      const [order, setOrder] = React.useState(['a', 'b', 'c']);
      React.useImperativeHandle(api, () => setOrder, []);
      return order.map((id) => (
        <OverflowItem key={id} itemId={id} data-testid={`item-${id}`}>
          {id.toUpperCase()}
        </OverflowItem>
      ));
    }
    render(
      <Overflow data-testid="overflow" overflowButton={renderButton}>
        <Items api={reorder} />
      </Overflow>,
    );
    expect(hiddenItems()).toEqual(['b', 'c']);

    await act(async () => {
      reorder.current?.(['c', 'a', 'b']);
    });
    expect(domItemOrder()).toEqual(['item-c', 'item-a', 'item-b']);
    expect(screen.getByTestId('item-c')).not.toHaveAttribute('data-overflow-hidden');
    expect(hiddenItems()).toEqual(['a', 'b']);
    expect(renderButton).toHaveBeenLastCalledWith(2, ['a', 'b']);
  });

  it('does not re-render when the row changes without reordering items (layout#3)', async () => {
    withResizeObserver();
    layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
    const showMark = React.createRef<(show: boolean) => void>();
    function Label({ api }: { api: React.Ref<(show: boolean) => void> }) {
      const [mark, setMark] = React.useState(false);
      React.useImperativeHandle(api, () => setMark, []);
      return <span>A{mark && <b>!</b>}</span>;
    }
    const onRender = vi.fn();
    render(
      <React.Profiler id="overflow" onRender={onRender}>
        <Overflow data-testid="overflow" overflowButton={moreButton}>
          <OverflowItem itemId="a" data-testid="item-a">
            <Label api={showMark} />
          </OverflowItem>
          <OverflowItem itemId="b" data-testid="item-b">
            B
          </OverflowItem>
          <OverflowItem itemId="c" data-testid="item-c">
            C
          </OverflowItem>
        </Overflow>
      </React.Profiler>,
    );
    expect(hiddenItems()).toEqual(['b', 'c']);
    onRender.mockClear();

    // An element added inside an item (a childList mutation in the row) renders only the Label.
    await act(async () => {
      showMark.current?.(true);
    });
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(hiddenItems()).toEqual(['b', 'c']);
  });

  describe('item removal', () => {
    // Removing an item changes no size a ResizeObserver watches (the container keeps its width):
    // only the unregistration re-measures.
    const row = (ids: string[], renderButton: OverflowProps['overflowButton']) => (
      <Overflow data-testid="overflow" overflowButton={renderButton}>
        {ids.map((id) => (
          <OverflowItem key={id} itemId={id} data-testid={`item-${id}`}>
            {id.toUpperCase()}
          </OverflowItem>
        ))}
      </Overflow>
    );

    it.each([
      ['with ResizeObserver', true],
      ['without ResizeObserver', false],
    ])(
      'shows the items that fit again once the overflowing ones are removed (%s)',
      (_name, observe) => {
        if (observe) withResizeObserver();
        const renderButton = vi.fn(moreButton);
        layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
        const { rerender } = render(row(['a', 'b', 'c'], renderButton));
        expect(hiddenItems()).toEqual(['b', 'c']);
        expect(screen.getByRole('button', { name: '+2' })).toBeInTheDocument();

        // A + B (80) fit in 100 once C is gone.
        rerender(row(['a', 'b'], renderButton));
        expect(hiddenItems()).toEqual([]);
        expect(screen.getByTestId('item-b')).not.toHaveAttribute('data-overflow-hidden');
        expect(screen.queryByRole('button')).toBeNull();
      },
    );

    it.each([
      ['with ResizeObserver', true],
      ['without ResizeObserver', false],
    ])(
      'drops a removed item from the count and the menu while others still overflow (%s)',
      (_name, observe) => {
        if (observe) withResizeObserver();
        const renderButton = vi.fn<(count: number, hiddenIds: string[]) => void>();
        const menus: string[][] = [];
        function MoreMenu() {
          const menu = useOverflowMenu();
          menus.push(menu.hiddenIds);
          return <button type="button">+{menu.count}</button>;
        }
        const withMenu: OverflowProps['overflowButton'] = (count, hiddenIds) => {
          renderButton(count, hiddenIds);
          return <MoreMenu />;
        };
        layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 70, 'item-c': 40, button: 30 });
        const { rerender } = render(row(['a', 'b', 'c'], withMenu));
        expect(renderButton).toHaveBeenLastCalledWith(2, ['b', 'c']);

        // A + B (110) still overflow 100: only B stays hidden.
        rerender(row(['a', 'b'], withMenu));
        expect(hiddenItems()).toEqual(['b']);
        expect(renderButton).toHaveBeenLastCalledWith(1, ['b']);
        expect(menus.at(-1)).toEqual(['b']);
        expect(screen.getByRole('button', { name: '+1' })).toBeInTheDocument();

        rerender(row(['a'], withMenu));
        expect(hiddenItems()).toEqual([]);
        expect(screen.queryByRole('button')).toBeNull();
      },
    );
  });

  it('follows an itemId change', () => {
    const renderButton = vi.fn(moreButton);
    layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
    const { rerender } = render(<ThreeItems overflowButton={renderButton} />);
    expect(renderButton).toHaveBeenLastCalledWith(2, ['b', 'c']);

    rerender(
      <Overflow data-testid="overflow" overflowButton={renderButton}>
        <OverflowItem itemId="a" data-testid="item-a">
          A
        </OverflowItem>
        <OverflowItem itemId="b" data-testid="item-b">
          B
        </OverflowItem>
        <OverflowItem itemId="z" data-testid="item-c">
          C
        </OverflowItem>
      </Overflow>,
    );
    expect(renderButton).toHaveBeenLastCalledWith(2, ['b', 'z']);
  });

  describe('overflow menu hooks (layout#4)', () => {
    it('useOverflowMenu reports the hidden ids in DOM order and their count', () => {
      const seen: Array<{ hiddenIds: string[]; count: number }> = [];
      function MoreMenu() {
        const menu = useOverflowMenu();
        seen.push(menu);
        return (
          <details>
            <summary>{menu.count} more</summary>
            <ul>
              {menu.hiddenIds.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          </details>
        );
      }
      layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
      render(<ThreeItems overflowButton={() => <MoreMenu />} />);

      expect(seen.at(-1)).toEqual({ hiddenIds: ['b', 'c'], count: 2 });
      expect(screen.getByText('2 more')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['b', 'c']);
    });

    it('useIsOverflowItemVisible reports per item', () => {
      function Probe({ id }: { id: string }) {
        const visible = useIsOverflowItemVisible(id);
        return <span data-testid={`probe-${id}`}>{visible ? 'visible' : 'hidden'}</span>;
      }
      layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
      render(
        <Overflow data-testid="overflow" overflowButton={moreButton}>
          <OverflowItem itemId="a" data-testid="item-a">
            A
          </OverflowItem>
          <OverflowItem itemId="b" data-testid="item-b">
            B
          </OverflowItem>
          <OverflowItem itemId="c" data-testid="item-c">
            C
          </OverflowItem>
          <Probe id="a" />
          <Probe id="c" />
        </Overflow>,
      );
      expect(screen.getByTestId('probe-a')).toHaveTextContent('visible');
      expect(screen.getByTestId('probe-c')).toHaveTextContent('hidden');
    });
  });

  describe('observation (layout#7, layout#8)', () => {
    it('works without ResizeObserver: measures once and on window resize', () => {
      expect(typeof globalThis.ResizeObserver).toBe('undefined');
      const stub = layoutWith({
        overflow: 100,
        'item-a': 40,
        'item-b': 40,
        'item-c': 40,
        button: 30,
      });
      render(<ThreeItems overflowButton={moreButton} />);
      expect(hiddenItems()).toEqual(['b', 'c']);

      stub.widths.overflow = 200;
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(hiddenItems()).toEqual([]);
    });

    it('creates one ResizeObserver per Overflow, not one per parent render', () => {
      withResizeObserver();
      const Base = globalThis.ResizeObserver;
      let constructed = 0;
      globalThis.ResizeObserver = class extends Base {
        constructor(callback: ResizeObserverCallback) {
          super(callback);
          constructed++;
        }
      };
      layoutWith({ overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30 });
      const { rerender } = render(<ThreeItems overflowButton={moreButton} />);
      const afterMount = constructed;
      expect(afterMount).toBe(1);

      for (let i = 0; i < 3; i++) rerender(<ThreeItems overflowButton={moreButton} />);
      expect(constructed).toBe(afterMount);
    });

    it('does not re-render when a resize leaves the hidden set unchanged', () => {
      const resize = withResizeObserver();
      const stub = layoutWith({
        overflow: 100,
        'item-a': 40,
        'item-b': 40,
        'item-c': 40,
        button: 30,
      });
      const onRender = vi.fn();
      render(
        <React.Profiler id="overflow" onRender={onRender}>
          <ThreeItems overflowButton={moreButton} />
        </React.Profiler>,
      );
      expect(hiddenItems()).toEqual(['b', 'c']);
      onRender.mockClear();

      stub.widths.overflow = 95;
      resize.trigger(screen.getByTestId('overflow'));
      resize.trigger(screen.getByTestId('overflow'));
      expect(onRender).not.toHaveBeenCalled();
      expect(hiddenItems()).toEqual(['b', 'c']);
    });

    it('re-measures when an item changes size', () => {
      const resize = withResizeObserver();
      const stub = layoutWith({
        overflow: 100,
        'item-a': 40,
        'item-b': 40,
        'item-c': 10,
        button: 30,
      });
      render(<ThreeItems overflowButton={moreButton} />);
      expect(hiddenItems()).toEqual([]);

      stub.widths['item-b'] = 60;
      resize.trigger(screen.getByTestId('item-b'));
      expect(hiddenItems()).toEqual(['b', 'c']);
    });
  });

  describe('refs (overlays#35)', () => {
    it('attaches a stable callback ref once across parent renders and runs its cleanup', () => {
      const cleanup = vi.fn();
      const rootRef = vi.fn((_node: HTMLDivElement | null) => cleanup);
      const itemCleanup = vi.fn();
      const itemRef = vi.fn((_node: HTMLDivElement | null) => itemCleanup);
      function App({ tick }: { tick: number }) {
        return (
          <Overflow ref={rootRef} data-testid="overflow" data-tick={tick}>
            <OverflowItem ref={itemRef} itemId="a" data-testid="item-a">
              A
            </OverflowItem>
          </Overflow>
        );
      }
      const { rerender, unmount } = render(<App tick={0} />);
      rerender(<App tick={1} />);
      rerender(<App tick={2} />);

      expect(rootRef).toHaveBeenCalledTimes(1);
      expect(rootRef).toHaveBeenCalledWith(screen.getByTestId('overflow'));
      expect(itemRef).toHaveBeenCalledTimes(1);
      expect(itemRef).toHaveBeenCalledWith(screen.getByTestId('item-a'));

      unmount();
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(itemCleanup).toHaveBeenCalledTimes(1);
      expect(rootRef).toHaveBeenCalledTimes(1);
    });
  });

  describe('duplicated itemIds', () => {
    const duplicate = (itemId: string) =>
      `[WaveUI] Overflow: several items share the itemId "${itemId}". Item ids must be unique ` +
      'within an Overflow; items with the same itemId are hidden and shown together.';

    it('warns once per itemId that several items share', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const row = (
        <Overflow>
          <OverflowItem itemId="a">A</OverflowItem>
          <OverflowItem itemId="a">A again</OverflowItem>
          <OverflowItem itemId="b">B</OverflowItem>
          <OverflowItem itemId="b">B again</OverflowItem>
          <OverflowItem itemId="b">B a third time</OverflowItem>
        </Overflow>
      );
      const { rerender } = render(row);
      rerender(row);
      expect(warn.mock.calls).toEqual([[duplicate('a')], [duplicate('b')]]);
    });

    it('does not warn in StrictMode, when keyed items are reordered or replaced, or across rows', async () => {
      const warn = vi.spyOn(console, 'warn');
      const rows = (ids: string[]) => (
        <React.StrictMode>
          <Overflow>
            {ids.map((id) => (
              <OverflowItem key={id} itemId={id.replace('-new', '')}>
                {id}
              </OverflowItem>
            ))}
          </Overflow>
          <Overflow>
            <OverflowItem itemId="a">Another row</OverflowItem>
          </Overflow>
        </React.StrictMode>
      );
      const { rerender } = render(rows(['a', 'b', 'c']));
      await act(async () => rerender(rows(['c', 'a', 'b'])));
      // A new element (another key) takes over the itemId of the one it replaces.
      await act(async () => rerender(rows(['c', 'a-new', 'b'])));
      expect(screen.getByText('a-new')).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('context (overlays#34)', () => {
    it('throws when OverflowItem is rendered outside Overflow', () => {
      expectThrows(
        <OverflowItem itemId="a">A</OverflowItem>,
        '[WaveUI] OverflowItem must be used within Overflow',
      );
    });

    it('in production, logs once per part outside Overflow and renders inertly (C-CONTEXT)', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      function Menu() {
        const { count } = useOverflowMenu();
        return <span>{count} hidden</span>;
      }
      const orphans = (
        <>
          <OverflowItem itemId="a" data-testid="item-a">
            A
          </OverflowItem>
          <OverflowItem itemId="b" data-testid="item-b">
            B
          </OverflowItem>
          <Menu />
        </>
      );
      const { rerender } = render(orphans);
      rerender(orphans);
      expect(screen.getByTestId('item-a')).not.toHaveAttribute('data-overflow-hidden');
      expect(screen.getByText('0 hidden')).toBeInTheDocument();
      expect(error.mock.calls).toEqual([
        ['[WaveUI] OverflowItem must be used within Overflow'],
        ['[WaveUI] useOverflowMenu must be used within Overflow'],
      ]);
    });

    it('throws when the overflow hooks are used outside Overflow', () => {
      function Menu() {
        useOverflowMenu();
        return null;
      }
      function Visible() {
        useIsOverflowItemVisible('a');
        return null;
      }
      expectThrows(<Menu />, '[WaveUI] useOverflowMenu must be used within Overflow');
      expectThrows(<Visible />, '[WaveUI] useIsOverflowItemVisible must be used within Overflow');
    });
  });
});

describe('Overflow - server rendering', () => {
  function Probe() {
    const ref = React.useRef<HTMLDivElement>(null);
    const isOverflowing = useIsOverflowing(ref);
    return (
      <div ref={ref} data-testid="box">
        {isOverflowing ? 'overflowing' : 'fits'}
      </div>
    );
  }

  const app = (
    <>
      <ThreeItems overflowButton={moreButton} />
      <Probe />
    </>
  );

  it('renders every item, no overflow button and a fitting useIsOverflowing on the server', () => {
    // Parsed into a detached element of this document (never attached to the body).
    const parsed = document.createElement('div');
    parsed.innerHTML = renderToString(app);
    const items = Array.from(parsed.querySelectorAll('[data-testid^="item-"]'));
    expect(items.map((el) => el.textContent)).toEqual(['A', 'B', 'C']);
    for (const el of items) {
      expect(el).not.toHaveAttribute('data-overflow-hidden');
      expect(el).not.toHaveAttribute('aria-hidden');
      expect(el.getAttribute('style')).toBeNull();
    }
    expect(parsed.querySelector('[data-overflow-button]')).toBeNull();
    expect(parsed.querySelector('[data-testid="box"]')?.textContent).toBe('fits');
  });

  it('hydrates the server HTML without a mismatch, then measures on the client', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(app);
    document.body.appendChild(container);
    layoutWith(
      { overflow: 100, 'item-a': 40, 'item-b': 40, 'item-c': 40, button: 30, box: 100 },
      { box: 180 },
    );
    const error = vi.spyOn(console, 'error');
    const onRecoverableError = vi.fn();
    const hydrated: { root?: Root } = {};
    try {
      await act(async () => {
        hydrated.root = hydrateRoot(container, app, { onRecoverableError });
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      // After hydration the client measures: B and C overflow, and the box overflows.
      expect(hiddenItems()).toEqual(['b', 'c']);
      expect(screen.getByRole('button', { name: '+2' })).toBeInTheDocument();
      expect(screen.getByTestId('box')).toHaveTextContent('overflowing');
    } finally {
      act(() => hydrated.root?.unmount());
      container.remove();
    }
  });
});

describe('OverflowItem', () => {
  it('forwards ref to the item div', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Overflow>
        <OverflowItem ref={ref} itemId="a" data-testid="item">
          Item
        </OverflowItem>
      </Overflow>,
    );
    expect(ref.current).toBe(screen.getByTestId('item'));
  });

  it('spreads rest props', () => {
    render(
      <Overflow>
        <OverflowItem itemId="a" data-testid="item" title="Item title">
          Item
        </OverflowItem>
      </Overflow>,
    );
    expect(screen.getByTestId('item')).toHaveAttribute('title', 'Item title');
  });

  it('has a displayName', () => {
    expect(OverflowItem.displayName).toBe('OverflowItem');
  });
});

describe('useIsOverflowing', () => {
  function RefProbe() {
    const ref = React.useRef<HTMLDivElement>(null);
    const isOverflowing = useIsOverflowing(ref);
    return (
      <div ref={ref} data-testid="box">
        {isOverflowing ? 'overflowing' : 'fits'}
      </div>
    );
  }

  it('returns false when the element is not overflowing', () => {
    layoutWith({ box: 100 }, { box: 100 });
    render(<RefProbe />);
    expect(screen.getByTestId('box')).toHaveTextContent('fits');
  });

  it('returns true when the content is wider than the element', () => {
    layoutWith({ box: 100 }, { box: 180 });
    render(<RefProbe />);
    expect(screen.getByTestId('box')).toHaveTextContent('overflowing');
  });

  it('reports the first overflow within the mounting commit, before the browser can paint', () => {
    layoutWith({ box: 100 }, { box: 180 });
    const commits: Array<{ phase: string; text: string | null }> = [];
    render(
      <React.Profiler
        id="probe"
        onRender={(_id, phase) =>
          commits.push({ phase, text: document.querySelector('[data-testid="box"]')!.textContent })
        }
      >
        <RefProbe />
      </React.Profiler>,
    );
    expect(commits).toEqual([
      { phase: 'mount', text: 'fits' },
      { phase: 'nested-update', text: 'overflowing' },
    ]);
  });

  it('works without ResizeObserver and updates on window resize (layout#7)', () => {
    expect(typeof globalThis.ResizeObserver).toBe('undefined');
    const stub = layoutWith({ box: 100 }, { box: 100 });
    render(<RefProbe />);
    expect(screen.getByTestId('box')).toHaveTextContent('fits');

    stub.widths.box = 50;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('box')).toHaveTextContent('overflowing');
  });

  it('updates when the element resizes', () => {
    const resize = withResizeObserver();
    const stub = layoutWith({ box: 100 }, { box: 100 });
    render(<RefProbe />);
    expect(screen.getByTestId('box')).toHaveTextContent('fits');

    stub.widths.box = 60;
    resize.trigger(screen.getByTestId('box'));
    expect(screen.getByTestId('box')).toHaveTextContent('overflowing');
  });

  it('updates when the content grows without the element resizing (layout#6)', async () => {
    withResizeObserver();
    const stub = layoutWith({ list: 100 }, { list: 100 });
    function Growing({ items }: { items: string[] }) {
      const ref = React.useRef<HTMLUListElement>(null);
      const isOverflowing = useIsOverflowing(ref);
      return (
        <>
          <ul ref={ref} data-testid="list">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <output data-testid="state">{isOverflowing ? 'overflowing' : 'fits'}</output>
        </>
      );
    }
    // The owner does not re-render when the list grows: a child list managed elsewhere.
    render(<Growing items={['one']} />);
    expect(screen.getByTestId('state')).toHaveTextContent('fits');

    stub.scrollWidths.list = 240;
    await act(async () => {
      const li = document.createElement('li');
      li.textContent = 'two';
      screen.getByTestId('list').appendChild(li);
    });
    expect(screen.getByTestId('state')).toHaveTextContent('overflowing');
    screen.getByTestId('list').lastChild?.remove();
  });

  it('re-checks text edits without re-observing the children; follows added and removed children one by one (layout#6)', async () => {
    withResizeObserver();
    const Base = globalThis.ResizeObserver;
    const observed: Element[] = [];
    const unobserved: Element[] = [];
    let disconnects = 0;
    globalThis.ResizeObserver = class extends Base {
      observe(target: Element) {
        observed.push(target);
        super.observe(target);
      }
      unobserve(target: Element) {
        unobserved.push(target);
        super.unobserve(target);
      }
      disconnect() {
        disconnects++;
        super.disconnect();
      }
    };
    const stub = layoutWith({ list: 100 }, { list: 100 });
    function List() {
      const ref = React.useRef<HTMLUListElement>(null);
      const isOverflowing = useIsOverflowing(ref);
      return (
        <>
          <ul ref={ref} data-testid="list">
            <li data-testid="first">one</li>
          </ul>
          <output data-testid="state">{isOverflowing ? 'overflowing' : 'fits'}</output>
        </>
      );
    }
    render(<List />);
    const list = screen.getByTestId('list');
    const first = screen.getByTestId('first');
    expect(observed).toEqual([list, first]);
    expect(screen.getByTestId('state')).toHaveTextContent('fits');
    observed.length = 0;

    // A text edit (a ticking counter, say) re-checks but leaves the observation alone.
    stub.scrollWidths.list = 240;
    await act(async () => {
      const text = first.firstChild;
      if (!(text instanceof Text)) throw new Error('expected a text node');
      text.data = 'one, now much longer';
    });
    expect(screen.getByTestId('state')).toHaveTextContent('overflowing');
    expect(observed).toEqual([]);
    expect(unobserved).toEqual([]);
    expect(disconnects).toBe(0);

    // A new direct child is observed on its own (the others are not re-observed) and a removed
    // one is unobserved; content deeper down only re-checks.
    const added = document.createElement('li');
    await act(async () => {
      list.appendChild(added);
    });
    expect(observed).toEqual([added]);
    await act(async () => {
      added.appendChild(document.createElement('span'));
    });
    expect(observed).toEqual([added]);
    stub.scrollWidths.list = 100;
    await act(async () => {
      added.remove();
    });
    expect(unobserved).toEqual([added]);
    expect(disconnects).toBe(0);
    expect(screen.getByTestId('state')).toHaveTextContent('fits');
  });

  it('observes an element that mounts after the hook (layout#6)', () => {
    layoutWith({ late: 100 }, { late: 300 });
    function Late({ show }: { show: boolean }) {
      const ref = React.useRef<HTMLDivElement>(null);
      const isOverflowing = useIsOverflowing(ref);
      return (
        <>
          {show && <div ref={ref} data-testid="late" />}
          <output data-testid="state">{isOverflowing ? 'overflowing' : 'fits'}</output>
        </>
      );
    }
    const { rerender } = render(<Late show={false} />);
    expect(screen.getByTestId('state')).toHaveTextContent('fits');

    rerender(<Late show />);
    expect(screen.getByTestId('state')).toHaveTextContent('overflowing');

    rerender(<Late show={false} />);
    expect(screen.getByTestId('state')).toHaveTextContent('fits');
  });

  it('accepts the element itself (callback-ref state)', () => {
    layoutWith({ el: 100 }, { el: 300 });
    function ElementProbe() {
      const [el, setEl] = React.useState<HTMLDivElement | null>(null);
      const isOverflowing = useIsOverflowing(el);
      return (
        <div ref={setEl} data-testid="el">
          {isOverflowing ? 'overflowing' : 'fits'}
        </div>
      );
    }
    render(<ElementProbe />);
    expect(screen.getByTestId('el')).toHaveTextContent('overflowing');
  });
});
