import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { renderToString } from 'react-dom/server';
import { act, render, screen } from '@testing-library/react';
import { usePresence } from '../usePresence';
import { usePresenceGroup, type PresenceGroupEntry } from '../usePresenceGroup';
import { mockAnimations, mockMatchMedia } from '../../test-utils';

/*
 * usePresenceGroup (spec §2.6, D9): the keyed children of a group, each rendered by the caller as
 * an item on the presence core. A child removed from the children stays, not visible, right after
 * the child that preceded it, until its item reports the end of its exit; a key that comes back
 * during the exit is visible again. Children of the group's first render never appear; children
 * added later appear with the group's `appear`. Children that are no element, or an element
 * without a key of the consumer's, are returned apart, in order. jsdom loads no CSS, so an exit
 * waits only where `mockAnimations` gives the item a running animation.
 */

let warn: MockInstance<typeof console.warn>;
let error: MockInstance<typeof console.error>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn');
  error = vi.spyOn(console, 'error');
});
afterEach(() => {
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

interface ItemProps {
  entry: PresenceGroupEntry;
  onExited: (key: string) => void;
}

/** An item as a caller renders one: the entry's element in a presence element. */
function Item({ entry, onExited }: ItemProps) {
  const { isMounted, ref, presenceProps } = usePresence(entry.visible, {
    appear: entry.appear,
    onExited: () => onExited(entry.key),
  });
  return isMounted ? (
    <div
      ref={ref}
      {...presenceProps}
      data-testid="item"
      data-visible={String(entry.visible)}
      data-appear={String(entry.appear)}
    >
      {entry.element}
    </div>
  ) : null;
}

interface GroupProps {
  children?: React.ReactNode;
  appear?: boolean;
  /** Called with the key each item reports the end of its exit for. */
  onItemExited?: (key: string) => void;
}

/** A group on the hook: the entries as items, then the skipped children in a box of their own. */
function Group({ children, appear = false, onItemExited }: GroupProps) {
  const { entries, skipped, onExited } = usePresenceGroup(children, { appear });
  return (
    <div data-testid="group" data-entries={entries.length}>
      {entries.map((entry) => (
        <Item
          key={entry.key}
          entry={entry}
          onExited={(key) => {
            onItemExited?.(key);
            onExited(key);
          }}
        />
      ))}
      <div data-testid="skipped">{skipped}</div>
    </div>
  );
}

/** Keyed children, one span per key, its text the key. */
const spans = (keys: readonly string[]) =>
  keys.map((key) => (
    <span key={key} data-child={key}>
      {key}
    </span>
  ));

const items = () => screen.queryAllByTestId('item');
const order = () => items().map((el) => el.textContent);
/** `key:phase` per item, in DOM order. */
const phases = () => items().map((el) => `${el.textContent}:${el.getAttribute('data-presence')}`);
const itemOf = (text: string) => {
  const found = items().find((el) => el.textContent === text);
  expect(found, `item ${text}`).toBeDefined();
  return found as HTMLElement;
};
const entryCount = () => Number(screen.getByTestId('group').getAttribute('data-entries'));
const isItem = (el: Element) => el.getAttribute('data-testid') === 'item';

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

describe('appearing (D9)', () => {
  it('the children of the first render do not appear, even with the group’s appear', () => {
    const motion = mockAnimations({ animated: isItem });
    render(<Group appear>{spans(['a', 'b'])}</Group>);
    expect(phases()).toEqual(['a:entered', 'b:entered']);
    expect(items().map((el) => el.getAttribute('data-appear'))).toEqual(['false', 'false']);
    expect(items().map((el) => el.getAttribute('data-visible'))).toEqual(['true', 'true']);
    expect(motion.started).toBe(0);
  });

  it('a child added later appears with the group’s appear', async () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(<Group appear>{spans(['a'])}</Group>);
    rerender(<Group appear>{spans(['a', 'b'])}</Group>);
    expect(phases()).toEqual(['a:entered', 'b:entering']);
    expect(itemOf('b')).toHaveAttribute('data-appear', 'true');
    await finish(motion);
    expect(phases()).toEqual(['a:entered', 'b:entered']);
  });

  it('a child added later mounts entered without the group’s appear', () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(<Group>{spans(['a'])}</Group>);
    rerender(<Group>{spans(['b', 'a'])}</Group>);
    expect(phases()).toEqual(['b:entered', 'a:entered']);
    expect(itemOf('b')).toHaveAttribute('data-appear', 'false');
    expect(motion.started).toBe(0);
  });
});

describe('removing (§2.6)', () => {
  it('a removed child stays, not visible and exiting, until its exit ends; then it is dropped', async () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(<Group>{spans(['a', 'b'])}</Group>);
    const b = itemOf('b');
    rerender(<Group>{spans(['a'])}</Group>);
    expect(phases()).toEqual(['a:entered', 'b:exiting']);
    expect(itemOf('b')).toBe(b);
    expect(b).toHaveAttribute('data-visible', 'false');
    expect(b).toHaveAttribute('inert');
    expect(entryCount()).toBe(2);
    await finish(motion);
    expect(order()).toEqual(['a']);
    expect(entryCount()).toBe(1);
  });

  it('a middle removal keeps the child between its neighbours while it exits', async () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(<Group>{spans(['a', 'b', 'c'])}</Group>);
    rerender(<Group>{spans(['a', 'c'])}</Group>);
    expect(phases()).toEqual(['a:entered', 'b:exiting', 'c:entered']);
    await finish(motion);
    expect(phases()).toEqual(['a:entered', 'c:entered']);
  });

  it('a removed first child stays first; removed neighbours keep their own order', async () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(<Group>{spans(['a', 'b', 'c'])}</Group>);
    rerender(<Group>{spans(['c'])}</Group>);
    expect(phases()).toEqual(['a:exiting', 'b:exiting', 'c:entered']);
    rerender(<Group>{spans(['c', 'd'])}</Group>);
    expect(phases()).toEqual(['a:exiting', 'b:exiting', 'c:entered', 'd:entered']);
    await finish(motion);
    expect(order()).toEqual(['c', 'd']);
  });

  it('a run of removed children follows the child that preceded the run, in its order', () => {
    mockAnimations({ animated: isItem });
    const { rerender } = render(<Group>{spans(['x', 'a', 'b', 'c'])}</Group>);
    rerender(<Group>{spans(['c', 'x'])}</Group>);
    expect(phases()).toEqual(['c:entered', 'x:entered', 'a:exiting', 'b:exiting']);
  });

  it('re-adding a key while it exits shows it again: the same item, entering, its new element', async () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(<Group>{spans(['a', 'b'])}</Group>);
    const b = itemOf('b');
    rerender(<Group>{spans(['a'])}</Group>);
    expect(b).toHaveAttribute('data-presence', 'exiting');
    rerender(
      <Group>
        <span key="a">a</span>
        <span key="b" data-version="2">
          b
        </span>
      </Group>,
    );
    expect(itemOf('b')).toBe(b);
    expect(b).toHaveAttribute('data-presence', 'entering');
    expect(b).toHaveAttribute('data-visible', 'true');
    expect(b).not.toHaveAttribute('inert');
    expect(b.firstElementChild).toHaveAttribute('data-version', '2');
    await finish(motion);
    expect(phases()).toEqual(['a:entered', 'b:entered']);
    expect(entryCount()).toBe(2);
  });

  it('a kept child renders its new element in the same item', () => {
    const { rerender } = render(<Group>{spans(['a'])}</Group>);
    const a = itemOf('a');
    rerender(
      <Group>
        <span key="a" data-version="2">
          a
        </span>
      </Group>,
    );
    expect(itemOf('a')).toBe(a);
    expect(a.firstElementChild).toHaveAttribute('data-version', '2');
  });

  it('under reduced motion a removed child goes within the same act', () => {
    mockAnimations({ animated: isItem });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const { rerender } = render(<Group>{spans(['a', 'b'])}</Group>);
    rerender(<Group>{spans(['a'])}</Group>);
    expect(order()).toEqual(['a']);
    expect(entryCount()).toBe(1);
  });

  it('without reduced motion the same removal waits for the item’s motion', async () => {
    const motion = mockAnimations({ animated: isItem });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const { rerender } = render(<Group>{spans(['a', 'b'])}</Group>);
    rerender(<Group>{spans(['a'])}</Group>);
    expect(phases()).toEqual(['a:entered', 'b:exiting']);
    await finish(motion);
    expect(order()).toEqual(['a']);
  });

  it('StrictMode: each exit ends once, and the entry is dropped once', async () => {
    const motion = mockAnimations({ animated: isItem });
    const exited = vi.fn();
    const { rerender } = render(
      <React.StrictMode>
        <Group onItemExited={exited}>{spans(['a', 'b', 'c'])}</Group>
      </React.StrictMode>,
    );
    rerender(
      <React.StrictMode>
        <Group onItemExited={exited}>{spans(['a'])}</Group>
      </React.StrictMode>,
    );
    expect(phases()).toEqual(['a:entered', 'b:exiting', 'c:exiting']);
    await finish(motion);
    expect(exited.mock.calls).toEqual([['.$b'], ['.$c']]);
    expect(order()).toEqual(['a']);
    expect(entryCount()).toBe(1);
  });
});

describe('reordering (Review Focus 4)', () => {
  it('[a, b, c] → [c, a, b] moves the same three items, all entered, into the new order', () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(<Group>{spans(['a', 'b', 'c'])}</Group>);
    const [a, b, c] = items();
    rerender(<Group>{spans(['c', 'a', 'b'])}</Group>);
    const after = items();
    expect(after).toHaveLength(3);
    expect(after[0]).toBe(c);
    expect(after[1]).toBe(a);
    expect(after[2]).toBe(b);
    expect(phases()).toEqual(['c:entered', 'a:entered', 'b:entered']);
    expect(motion.started).toBe(0);
  });

  it('[a, b, c] → [c, a] keeps b exiting right after a, and replaces no other item', async () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(<Group>{spans(['a', 'b', 'c'])}</Group>);
    const [a, b, c] = items();
    rerender(<Group>{spans(['c', 'a'])}</Group>);
    const after = items();
    expect(after).toHaveLength(3);
    expect(after[0]).toBe(c);
    expect(after[1]).toBe(a);
    expect(after[2]).toBe(b);
    expect(phases()).toEqual(['c:entered', 'a:entered', 'b:exiting']);
    await finish(motion);
    expect(items()).toEqual([c, a]);
  });
});

describe('children (C-COMPOUND)', () => {
  it('flattens Fragments: their keyed children are entries in order', async () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(
      <Group>
        <>
          <span key="a">a</span>
          <span key="b">b</span>
        </>
        <React.Fragment key="more">
          <span key="c">c</span>
        </React.Fragment>
      </Group>,
    );
    expect(phases()).toEqual(['a:entered', 'b:entered', 'c:entered']);
    expect(screen.getByTestId('skipped')).toBeEmptyDOMElement();
    rerender(
      <Group>
        <>
          <span key="b">b</span>
        </>
        <React.Fragment key="more">
          <span key="c">c</span>
        </React.Fragment>
      </Group>,
    );
    expect(phases()).toEqual(['a:exiting', 'b:entered', 'c:entered']);
    await finish(motion);
    expect(order()).toEqual(['b', 'c']);
  });

  it('a keyed child of an array next to other children is an entry, and so is a key with a slash', () => {
    const mapped = ['x', 'y'].map((key) => <span key={key}>{key}</span>);
    render(
      <Group>
        <span key="intro">intro</span>
        {mapped}
        <span key="errors/42">errors/42</span>
      </Group>,
    );
    expect(order()).toEqual(['intro', 'x', 'y', 'errors/42']);
    expect(screen.getByTestId('skipped')).toBeEmptyDOMElement();
  });

  it('returns text, numbers and elements without a key of the consumer’s apart, in order', () => {
    render(
      <Group>
        {'Loose'}
        <span key="a">a</span>
        <em>no key</em>
        {7}
        <>
          <strong>in a Fragment</strong>
        </>
      </Group>,
    );
    expect(order()).toEqual(['a']);
    const skipped = screen.getByTestId('skipped');
    expect(skipped).toHaveTextContent('Looseno key7in a Fragment');
    expect(Array.from(skipped.children).map((el) => el.localName)).toEqual(['em', 'strong']);
    expect(entryCount()).toBe(1);
  });

  it('a removed child that comes back after it was dropped is a new entry', async () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(<Group appear>{spans(['a', 'b'])}</Group>);
    const b = itemOf('b');
    rerender(<Group appear>{spans(['a'])}</Group>);
    await finish(motion);
    expect(order()).toEqual(['a']);
    rerender(<Group appear>{spans(['a', 'b'])}</Group>);
    expect(itemOf('b')).not.toBe(b);
    expect(itemOf('b')).toHaveAttribute('data-presence', 'entering');
    expect(itemOf('b')).toHaveAttribute('data-appear', 'true');
  });
});

describe('server rendering (D9)', () => {
  it('renders every child entered, with the group’s appear too', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Group appear>{spans(['a', 'b', 'c'])}</Group>);
    const rendered = Array.from(container.querySelectorAll('[data-testid="item"]'));
    expect(rendered.map((el) => el.textContent)).toEqual(['a', 'b', 'c']);
    for (const el of rendered) {
      expect(el).toHaveAttribute('data-presence', 'entered');
      expect(el).toHaveAttribute('data-appear', 'false');
      expect(el).not.toHaveAttribute('inert');
    }
  });
});
