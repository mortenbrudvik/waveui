import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBar } from '../MessageBar';
import { MessageBarGroup, type MessageBarGroupProps } from '../MessageBarGroup';
import { messageBarClassNames, messageBarGroupClassNames } from '../../../lib/classNames';
import {
  messageBarGroupEnterMotion,
  messageBarGroupExitMotion,
  messageBarGroupItemStructure,
} from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  expectNoA11yViolations,
  honourInert,
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
  testSystemProps,
} from '../../../test-utils';

/*
 * P10-MBG (spec §8, §2.6, D9, D21): MessageBarGroup stacks its keyed MessageBar children, each in
 * an item element (the presence element) whose default motion collapses and fades a removed bar
 * out (`animate="exit-only"`), and with `animate="both"` also opens and fades an added bar in.
 * Bars present at the group's first render never animate. Focus in a bar that leaves moves to the
 * next remaining bar, else the previous one. jsdom loads no CSS, so an exit waits only where
 * `mockAnimations` gives the item a running animation.
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

const CHILDREN_WARNING =
  '[WaveUI] MessageBarGroup: every child should be an element with a key of its own (a MessageBar with `key={id}`); other children render after the bars, without motion.';

/** The default motion of `animate`: the exit, plus the enter with `'both'`. */
const RECIPE = {
  'exit-only': messageBarGroupExitMotion,
  both: `${messageBarGroupExitMotion} ${messageBarGroupEnterMotion}`,
} as const;

interface GroupOptions extends Omit<MessageBarGroupProps, 'children'> {
  /** Gives every bar a Dismiss button (calling `onDismiss` with its id). */
  onDismiss?: (id: string) => void;
}

/** A group of bars, one per id, each marked with `data-bar` and saying `Message <id>`. */
function group(ids: readonly string[], { onDismiss, ...props }: GroupOptions = {}) {
  return (
    <MessageBarGroup {...props}>
      {ids.map((id) => (
        <MessageBar
          key={id}
          data-bar={id}
          onDismiss={onDismiss ? () => onDismiss(id) : undefined}
        >{`Message ${id}`}</MessageBar>
      ))}
    </MessageBarGroup>
  );
}

interface DismissibleProps extends Omit<MessageBarGroupProps, 'children'> {
  initial: readonly string[];
  /** Ids rendered without a Dismiss button (and so without anything tabbable). */
  plain?: readonly string[];
  onDismissed?: (id: string) => void;
}

/** A group whose bars remove themselves from its state when dismissed. */
function DismissibleGroup({ initial, plain = [], onDismissed, ...props }: DismissibleProps) {
  const [ids, setIds] = React.useState(initial);
  return (
    <MessageBarGroup {...props}>
      {ids.map((id) => (
        <MessageBar
          key={id}
          data-bar={id}
          onDismiss={
            plain.includes(id)
              ? undefined
              : () => {
                  onDismissed?.(id);
                  setIds((current) => current.filter((other) => other !== id));
                }
          }
        >{`Message ${id}`}</MessageBar>
      ))}
    </MessageBarGroup>
  );
}

const items = () =>
  Array.from(document.querySelectorAll<HTMLElement>(`.${messageBarGroupClassNames.item}`));
/** The ids of the bars, in DOM order. */
const order = () => items().map((el) => el.firstElementChild?.getAttribute('data-bar'));
/** `id:phase` per item, in DOM order. */
const phases = () =>
  items().map(
    (el) => `${el.firstElementChild?.getAttribute('data-bar')}:${el.getAttribute('data-presence')}`,
  );
const barOf = (id: string) => {
  const bar = document.querySelector<HTMLElement>(`[data-bar="${id}"]`);
  expect(bar, `bar ${id}`).not.toBeNull();
  return bar as HTMLElement;
};
const itemOf = (id: string) => barOf(id).parentElement as HTMLElement;
const dismissOf = (id: string) => within(barOf(id)).getByRole('button', { name: 'Dismiss' });
const root = () => document.querySelector<HTMLElement>(`.${messageBarGroupClassNames.root}`);
/** The presence element of every bar: its item. */
const isItem = (el: Element) => el.classList.contains(messageBarGroupClassNames.item);

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/** No word of `recipe` on `el`. */
function expectNoWordOf(el: Element, recipe: string) {
  const words = motionClasses(recipe);
  expect(words.length).toBeGreaterThan(0);
  for (const word of words) expect(el, word).not.toHaveClass(word);
}

describe('MessageBarGroup', () => {
  testSystemProps(MessageBarGroup, {
    expectedTag: 'div',
    displayName: 'MessageBarGroup',
    defaultProps: {
      children: (
        <MessageBar key="saved" status="success">
          Saved.
        </MessageBar>
      ),
    },
    conflictingClass: { className: 'gap-4', overrides: 'gap-2' },
  });
});

describe('markup (§8)', () => {
  it('stacks the bars in a root without a role, data-animate rendered with its default', () => {
    render(group(['a', 'b', 'c']));
    const el = root();
    expect(el).not.toBeNull();
    expect(el?.classList[0]).toBe(messageBarGroupClassNames.root);
    expect(el).toHaveClass('flex', 'flex-col', 'gap-2');
    expect(el).toHaveAttribute('data-animate', 'exit-only');
    expect(el).not.toHaveAttribute('role');
    // The items are the root's only children, one per bar.
    expect(Array.from(el?.children ?? [])).toEqual(items());
    expect(order()).toEqual(['a', 'b', 'c']);
  });

  it('puts each bar present at mount in an entered item with the structure and the exit motion', () => {
    render(group(['a', 'b', 'c']));
    for (const item of items()) {
      expect(item.classList[0]).toBe(messageBarGroupClassNames.item);
      expect(item).toHaveClass(
        ...motionClasses(messageBarGroupItemStructure),
        ...motionClasses(messageBarGroupExitMotion),
      );
      expectNoWordOf(item, messageBarGroupEnterMotion);
      expect(item).toHaveAttribute('data-presence', 'entered');
      expect(item).not.toHaveAttribute('inert');
      // The bar is the item's only child; the item has no other attribute than its phase.
      expect(item.children).toHaveLength(1);
      expect(item.firstElementChild).toHaveClass(messageBarClassNames.root);
      expect(item.getAttributeNames().sort()).toEqual(['class', 'data-presence']);
    }
  });

  it('animate="both" renders data-animate="both" and adds the enter motion to every item', () => {
    render(group(['a', 'b'], { animate: 'both' }));
    expect(root()).toHaveAttribute('data-animate', 'both');
    for (const item of items()) {
      expect(item).toHaveClass(
        ...motionClasses(messageBarGroupItemStructure),
        ...motionClasses(messageBarGroupExitMotion),
        ...motionClasses(messageBarGroupEnterMotion),
      );
      expect(item).toHaveAttribute('data-presence', 'entered');
    }
  });

  it('passes the consumer’s props to the root, ref included', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <MessageBarGroup ref={ref} id="notices" aria-label="Notices" role="region">
        <MessageBar key="a">Saved.</MessageBar>
      </MessageBarGroup>,
    );
    expect(ref.current).toBe(root());
    expect(root()).toHaveAttribute('id', 'notices');
    expect(screen.getByRole('region', { name: 'Notices' })).toBe(root());
  });
});

describe('motion slot (D5, D6)', () => {
  it.each(['exit-only', 'both'] as const)(
    '%s: undefined keeps the default motion; null drops it and keeps the structure and the phase',
    (animate) => {
      const { unmount } = render(group(['a'], { animate }));
      expect(items()[0]).toHaveClass(...motionClasses(RECIPE[animate]));
      unmount();
      render(group(['a'], { animate, motion: null }));
      const [item] = items();
      expectNoWordOf(item, RECIPE[animate]);
      expect(item).toHaveClass(...motionClasses(messageBarGroupItemStructure));
      expect(item).toHaveAttribute('data-presence', 'entered');
    },
  );

  it.each<[string, MotionSlot, 'exit-only' | 'both']>([
    ['a string', 'my-motion', 'exit-only'],
    ['{ className }', { className: 'my-motion' }, 'exit-only'],
    ['a string with both', 'my-motion', 'both'],
    ['{ className } with both', { className: 'my-motion' }, 'both'],
  ])('%s replaces the motion of every item, the structure kept', (_, slot, animate) => {
    render(group(['a', 'b'], { animate, motion: slot }));
    for (const item of items()) {
      expect(item).toHaveClass('my-motion', ...motionClasses(messageBarGroupItemStructure));
      expectNoWordOf(item, RECIPE[animate]);
    }
  });

  it('the provider’s none drops the default motion; the group’s own motion still applies', () => {
    const { rerender } = renderWithProviders(group(['a'], { animate: 'both' }), {
      motion: 'none',
    });
    expectNoWordOf(items()[0], RECIPE.both);
    expect(items()[0]).toHaveClass(...motionClasses(messageBarGroupItemStructure));
    rerender(group(['a'], { animate: 'both', motion: 'my-motion' }));
    expect(items()[0]).toHaveClass('my-motion');
  });
});

describe('presence (D7, D9)', () => {
  it('a removed bar stays, exiting and inert, until its exit ends', async () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(group(['a', 'b', 'c']));
    const b = itemOf('b');
    const bar = barOf('b');
    rerender(group(['a', 'c']));
    expect(itemOf('b')).toBe(b);
    expect(barOf('b')).toBe(bar);
    expect(b).toHaveAttribute('data-presence', 'exiting');
    expect(bar.closest('[inert]')).toBe(b);
    // The middle bar stays between its neighbours while it exits.
    expect(phases()).toEqual(['a:entered', 'b:exiting', 'c:entered']);
    await finish(motion);
    expect(phases()).toEqual(['a:entered', 'c:entered']);
    expect(b.isConnected).toBe(false);
  });

  it('bars present at the first render never animate, with animate="both" too', () => {
    const motion = mockAnimations({ animated: isItem });
    render(group(['a', 'b'], { animate: 'both' }));
    expect(phases()).toEqual(['a:entered', 'b:entered']);
    expect(motion.started).toBe(0);
  });

  it('exit-only: a bar added after mount is entered at once', () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(group(['a']));
    rerender(group(['a', 'b']));
    expect(phases()).toEqual(['a:entered', 'b:entered']);
    expect(motion.started).toBe(0);
  });

  it('both: a bar added after mount enters with its motion', async () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(group(['a'], { animate: 'both' }));
    rerender(group(['b', 'a'], { animate: 'both' }));
    expect(phases()).toEqual(['b:entering', 'a:entered']);
    await finish(motion);
    expect(phases()).toEqual(['b:entered', 'a:entered']);
  });

  it('re-adding a key during its exit shows the same bar again, entering, not inert', async () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(group(['a', 'b', 'c']));
    const b = itemOf('b');
    const bar = barOf('b');
    rerender(group(['a', 'c']));
    expect(b).toHaveAttribute('data-presence', 'exiting');
    rerender(group(['a', 'b', 'c']));
    expect(itemOf('b')).toBe(b);
    expect(barOf('b')).toBe(bar);
    expect(b).toHaveAttribute('data-presence', 'entering');
    expect(bar.closest('[inert]')).toBeNull();
    await finish(motion);
    expect(phases()).toEqual(['a:entered', 'b:entered', 'c:entered']);
  });

  it('under reduced motion a removed bar goes within the same act', () => {
    mockAnimations({ animated: isItem });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const { rerender } = render(group(['a', 'b'], { animate: 'both' }));
    rerender(group(['a'], { animate: 'both' }));
    expect(order()).toEqual(['a']);
    rerender(group(['a', 'c'], { animate: 'both' }));
    expect(phases()).toEqual(['a:entered', 'c:entered']);
  });

  it('without reduced motion the same removal and addition wait for the item’s motion', async () => {
    const motion = mockAnimations({ animated: isItem });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const { rerender } = render(group(['a', 'b'], { animate: 'both' }));
    rerender(group(['a', 'c'], { animate: 'both' }));
    expect(phases()).toEqual(['a:entered', 'b:exiting', 'c:entering']);
    await finish(motion);
    expect(phases()).toEqual(['a:entered', 'c:entered']);
  });

  it('StrictMode: a dismissed bar is dismissed once and leaves once', async () => {
    const motion = mockAnimations({ animated: isItem });
    const onDismissed = vi.fn();
    const user = userEvent.setup();
    render(
      <React.StrictMode>
        <DismissibleGroup initial={['a', 'b', 'c']} onDismissed={onDismissed} />
      </React.StrictMode>,
    );
    await user.click(dismissOf('b'));
    expect(onDismissed.mock.calls).toEqual([['b']]);
    expect(phases()).toEqual(['a:entered', 'b:exiting', 'c:entered']);
    await finish(motion);
    expect(phases()).toEqual(['a:entered', 'c:entered']);
    expect(items()).toHaveLength(2);
  });
});

describe('keyed reorders (Review Focus 4)', () => {
  it('[a, b, c] → [c, a, b] moves the same three items, all entered, into the new order', () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(group(['a', 'b', 'c'], { animate: 'both' }));
    const [a, b, c] = items();
    const bars = ['a', 'b', 'c'].map(barOf);
    rerender(group(['c', 'a', 'b'], { animate: 'both' }));
    expect(items()).toEqual([c, a, b]);
    expect(items()[0]).toBe(c);
    expect(items()[1]).toBe(a);
    expect(items()[2]).toBe(b);
    expect(['a', 'b', 'c'].map(barOf)).toEqual(bars);
    expect(phases()).toEqual(['c:entered', 'a:entered', 'b:entered']);
    expect(Array.from(root()?.children ?? [])).toEqual([c, a, b]);
    expect(motion.started).toBe(0);
  });

  it('[a, b, c] → [c, a] keeps b exiting right after a, and replaces no other node', async () => {
    const motion = mockAnimations({ animated: isItem });
    const { rerender } = render(group(['a', 'b', 'c']));
    const [a, b, c] = items();
    const bars = ['a', 'b', 'c'].map(barOf);
    rerender(group(['c', 'a']));
    expect(items()[0]).toBe(c);
    expect(items()[1]).toBe(a);
    expect(items()[2]).toBe(b);
    expect(['a', 'b', 'c'].map(barOf)).toEqual(bars);
    expect(phases()).toEqual(['c:entered', 'a:entered', 'b:exiting']);
    await finish(motion);
    expect(Array.from(root()?.children ?? [])).toEqual([c, a]);
  });
});

describe('focus (§8)', () => {
  it('focus on a dismissed bar’s button moves to the next bar’s first tabbable element', async () => {
    const motion = mockAnimations({ animated: isItem });
    honourInert();
    const user = userEvent.setup();
    render(<DismissibleGroup initial={['a', 'b', 'c']} />);
    await user.click(dismissOf('b'));
    expect(itemOf('b')).toHaveAttribute('data-presence', 'exiting');
    expect(dismissOf('c')).toHaveFocus();
    await finish(motion);
    expect(order()).toEqual(['a', 'c']);
    expect(dismissOf('c')).toHaveFocus();
  });

  it('…else to the previous bar’s, when the last bar leaves', async () => {
    const motion = mockAnimations({ animated: isItem });
    honourInert();
    const user = userEvent.setup();
    render(<DismissibleGroup initial={['a', 'b', 'c']} />);
    await user.click(dismissOf('c'));
    expect(dismissOf('b')).toHaveFocus();
    await finish(motion);
    expect(dismissOf('b')).toHaveFocus();
  });

  it('skips a bar that leaves in the same commit', () => {
    mockAnimations({ animated: isItem });
    honourInert();
    const { rerender } = render(group(['a', 'b', 'c', 'd'], { onDismiss: () => {} }));
    act(() => dismissOf('b').focus());
    // b and c leave together: c is exiting, so the next bar that stays is d.
    rerender(group(['a', 'd'], { onDismiss: () => {} }));
    expect(dismissOf('d')).toHaveFocus();
  });

  it('passes over a bar without a tabbable element to the one after it', async () => {
    mockAnimations({ animated: isItem });
    honourInert();
    const user = userEvent.setup();
    render(<DismissibleGroup initial={['a', 'b', 'c']} plain={['b']} />);
    await user.click(dismissOf('a'));
    expect(dismissOf('c')).toHaveFocus();
  });

  it('with no motion, moves before the bar unmounts', async () => {
    honourInert();
    const user = userEvent.setup();
    render(<DismissibleGroup initial={['a', 'b', 'c']} motion={null} />);
    await user.click(dismissOf('b'));
    expect(order()).toEqual(['a', 'c']);
    expect(dismissOf('c')).toHaveFocus();
  });

  it('leaves focus outside the leaving bar where it is', async () => {
    const motion = mockAnimations({ animated: isItem });
    honourInert();
    const { rerender } = render(
      <>
        <button type="button">Elsewhere</button>
        {group(['a', 'b'], { onDismiss: () => {} })}
      </>,
    );
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    act(() => elsewhere.focus());
    rerender(
      <>
        <button type="button">Elsewhere</button>
        {group(['a'], { onDismiss: () => {} })}
      </>,
    );
    expect(elsewhere).toHaveFocus();
    await finish(motion);
    expect(elsewhere).toHaveFocus();
  });
});

describe('children (§8)', () => {
  it.each<[string, React.ReactNode]>([
    ['a text child', 'Two more messages'],
    ['an element without a key', <MessageBar status="warning">No key.</MessageBar>],
  ])(
    '%s renders after the bars, without an item and without motion, with one warning',
    (_, child) => {
      // Silenced: every call is asserted below.
      warn.mockImplementation(() => {});
      const { rerender } = render(
        <MessageBarGroup>
          {child}
          <MessageBar key="a" data-bar="a">
            Message a
          </MessageBar>
        </MessageBarGroup>,
      );
      expect(warn.mock.calls).toEqual([[CHILDREN_WARNING]]);
      const children = Array.from(root()?.childNodes ?? []);
      expect(children).toHaveLength(2);
      // The keyed bar's item first, then the child as given: no item around it.
      expect(children[0]).toBe(itemOf('a'));
      if (children[1] instanceof Element) {
        expect(children[1]).toHaveClass(messageBarClassNames.root);
        expect(children[1]).not.toHaveClass(messageBarGroupClassNames.item);
      } else {
        expect(children[1].nodeType).toBe(Node.TEXT_NODE);
        expect(children[1].textContent).toBe('Two more messages');
      }
      expect(items()).toHaveLength(1);
      // Once per page: a re-render does not warn again.
      rerender(
        <MessageBarGroup>
          {child}
          <MessageBar key="a">Message a</MessageBar>
        </MessageBarGroup>,
      );
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockClear();
    },
  );

  it('a group of keyed bars, in Fragments and arrays too, does not warn', () => {
    render(
      <MessageBarGroup>
        <MessageBar key="intro" data-bar="intro">
          Intro
        </MessageBar>
        {['x', 'y'].map((id) => (
          <MessageBar key={id} data-bar={id}>{`Message ${id}`}</MessageBar>
        ))}
        <>
          <MessageBar key="z" data-bar="z">
            Message z
          </MessageBar>
        </>
      </MessageBarGroup>,
    );
    expect(order()).toEqual(['intro', 'x', 'y', 'z']);
  });
});

describe('server rendering (D9)', () => {
  const page = group(['a', 'b', 'c'], { animate: 'both', onDismiss: () => {} });

  it('renders every bar entered in the server HTML, and hydration logs nothing', async () => {
    const html = renderToString(page);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    let hydrated: ReturnType<typeof hydrateRoot> | undefined;
    const itemsIn = () =>
      Array.from(container.querySelectorAll<HTMLElement>(`.${messageBarGroupClassNames.item}`));
    try {
      const rendered = itemsIn();
      expect(rendered.map((item) => item.firstElementChild?.getAttribute('data-bar'))).toEqual([
        'a',
        'b',
        'c',
      ]);
      for (const item of rendered) {
        expect(item).toHaveAttribute('data-presence', 'entered');
        expect(item).not.toHaveAttribute('inert');
      }
      await act(async () => {
        hydrated = hydrateRoot(container, page, { onRecoverableError });
      });
      expect(itemsIn()).toEqual(rendered);
      for (const item of rendered) expect(item).toHaveAttribute('data-presence', 'entered');
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      act(() => hydrated?.unmount());
      container.remove();
    }
  });
});

describe('accessibility', () => {
  it('has no violations with three bars', async () => {
    render(
      <MessageBarGroup>
        <MessageBar key="a" status="info" onDismiss={() => {}}>
          A new version is available.
        </MessageBar>
        <MessageBar key="b" status="warning" onDismiss={() => {}}>
          Your session expires soon.
        </MessageBar>
        <MessageBar key="c" status="error" onDismiss={() => {}}>
          The file could not be saved.
        </MessageBar>
      </MessageBarGroup>,
    );
    await expectNoA11yViolations();
  });

  it('has no violations while a bar exits', async () => {
    mockAnimations({ animated: isItem });
    const { rerender } = render(group(['a', 'b', 'c'], { onDismiss: () => {} }));
    rerender(group(['a', 'c'], { onDismiss: () => {} }));
    expect(itemOf('b')).toHaveAttribute('data-presence', 'exiting');
    await expectNoA11yViolations();
  });
});
