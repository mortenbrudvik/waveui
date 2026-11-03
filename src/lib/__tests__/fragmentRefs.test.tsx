import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { withFragmentRefs } from '../fragmentRefs';
import { unwrapFragment } from '../renderTrigger';
import { flattenChildren } from '../children';
import { Popover } from '../../components/overlays/Popover';
import { Dialog } from '../../components/overlays/Dialog';
import { Tooltip } from '../../components/overlays/Tooltip';
import { Presence } from '../../components/motion/Presence';
import { Overflow, OverflowItem } from '../../components/layout/Overflow';
import { Button } from '../../components/button/Button';
import { installResizeObserverMock } from '../../test-utils';

/** What React 19.3 gives a `<Fragment ref>`: an instance that acts on the Fragment's DOM children. */
interface FragmentInstanceLike {
  focus: () => void;
  getRootNode: () => Node;
}

function usedRef() {
  const calls: Array<FragmentInstanceLike | null> = [];
  const ref = (instance: React.FragmentInstance | null) => {
    calls.push(instance as unknown as FragmentInstanceLike | null);
  };
  return { ref, calls };
}

describe('withFragmentRefs (a `<Fragment ref>` around a child that Wave unwraps)', () => {
  it('gives the ref back to a Fragment around the single element, at any depth', () => {
    const ref = () => {};
    const original = (
      <React.Fragment key="outer" ref={ref}>
        <>
          <React.Fragment ref={ref}>
            <span />
          </React.Fragment>
        </>
      </React.Fragment>
    );
    const found = unwrapFragment(original);
    expect(React.isValidElement(found) && found.type).toBe('span');
    const rendered = withFragmentRefs(original, <b />) as React.ReactElement<{
      children: React.ReactElement;
    }>;
    expect(rendered.type).toBe(React.Fragment);
    expect(rendered.key).toBe('outer');
    // The Fragment without a ref between the two is dropped, as unwrapFragment drops it.
    const inner = rendered.props.children as React.ReactElement<{ children: React.ReactElement }>;
    expect(inner.type).toBe(React.Fragment);
    expect((inner.props.children as React.ReactElement).type).toBe('b');
  });

  it('returns the rendered element as it is for a Fragment without a ref, and for anything else', () => {
    const rendered = <b />;
    expect(
      withFragmentRefs(
        <>
          <span />
        </>,
        rendered,
      ),
    ).toBe(rendered);
    expect(withFragmentRefs(<span />, rendered)).toBe(rendered);
    expect(withFragmentRefs('text', rendered)).toBe(rendered);
    expect(withFragmentRefs(null, rendered)).toBe(rendered);
  });

  it('returns the rendered element for a Fragment that unwrapFragment keeps (no single element)', () => {
    const ref = () => {};
    const kept = (
      <React.Fragment ref={ref}>
        <span />
        <span />
      </React.Fragment>
    );
    expect(unwrapFragment(kept)).toBe(kept);
    const rendered = <b />;
    expect(withFragmentRefs(kept, rendered)).toBe(rendered);
  });
});

describe('<Fragment ref> around a trigger, a tooltip target, a presence child and an asChild item', () => {
  it('Popover.Trigger: the ref attaches once and the trigger is still the element itself', async () => {
    const { ref, calls } = usedRef();
    render(
      <Popover>
        <Popover.Trigger>
          <React.Fragment ref={ref}>
            <Button>Open</Button>
          </React.Fragment>
        </Popover.Trigger>
        <Popover.Content>Body</Popover.Content>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    // No wrapper element: the trigger is a direct child of the render container.
    expect(trigger.parentElement).toBe(document.body.firstElementChild);
    expect(trigger.parentElement?.children).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toBeNull();
    // The instance acts on the element: focusing the Fragment focuses the trigger.
    act(() => calls[0]!.focus());
    expect(trigger).toHaveFocus();
  });

  it('Dialog.Trigger under StrictMode attaches, detaches and attaches again', () => {
    const { ref, calls } = usedRef();
    render(
      <React.StrictMode>
        <Dialog>
          <Dialog.Trigger>
            <React.Fragment ref={ref}>
              <Button>Open dialog</Button>
            </React.Fragment>
          </Dialog.Trigger>
        </Dialog>
      </React.StrictMode>,
    );
    expect(calls.filter((call) => call !== null).length).toBeGreaterThan(0);
    expect(calls.at(-1)).not.toBeNull();
  });

  it('a trigger whose child is a Fragment without a ref renders as before', () => {
    render(
      <Popover>
        <Popover.Trigger>
          <>
            <Button>Open</Button>
          </>
        </Popover.Trigger>
        <Popover.Content>Body</Popover.Content>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('Tooltip: the ref attaches and the target keeps its description', () => {
    const { ref, calls } = usedRef();
    render(
      <Tooltip content="Help">
        <React.Fragment ref={ref}>
          <Button>Target</Button>
        </React.Fragment>
      </Tooltip>,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toBeNull();
    const target = screen.getByRole('button', { name: 'Target' });
    expect(target).toHaveAccessibleDescription('Help');
    act(() => calls[0]!.focus());
    expect(target).toHaveFocus();
  });

  it('Presence: the ref attaches and the child gets the presence attributes', () => {
    const { ref, calls } = usedRef();
    render(
      <Presence visible>
        <React.Fragment ref={ref}>
          <div data-testid="child">Saved</div>
        </React.Fragment>
      </Presence>,
    );
    expect(screen.getByTestId('child')).toHaveAttribute('data-presence', 'entered');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.getRootNode()).toBe(document);
  });

  it('Presence: the ref detaches when the child exits and attaches when it comes back', () => {
    const { ref, calls } = usedRef();
    const tree = (visible: boolean) => (
      <Presence visible={visible} unmountOnExit>
        <React.Fragment ref={ref}>
          <div data-testid="child">Saved</div>
        </React.Fragment>
      </Presence>
    );
    const { rerender } = render(tree(true));
    rerender(tree(false));
    expect(screen.queryByTestId('child')).toBeNull();
    rerender(tree(true));
    expect(calls.map((call) => call !== null)).toEqual([true, false, true]);
  });

  it('Overflow.Item asChild: the ref attaches and the item props land on the element', () => {
    installResizeObserverMock();
    const { ref, calls } = usedRef();
    render(
      <Overflow role="list" aria-label="Pages">
        <OverflowItem asChild itemId="a">
          <React.Fragment ref={ref}>
            <li data-testid="item-a">A</li>
          </React.Fragment>
        </OverflowItem>
      </Overflow>,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toBeNull();
    const item = screen.getByTestId('item-a');
    expect(item.tagName).toBe('LI');
    expect(item.parentElement).toHaveAttribute('role', 'list');
  });
});

describe('flattenChildren and a Fragment ref (documented limit)', () => {
  it('opens a Fragment that carries a ref: its children are listed, the ref is not attached', () => {
    const { ref, calls } = usedRef();
    const flat = flattenChildren(
      <React.Fragment ref={ref}>
        <span key="a" />
        <span key="b" />
      </React.Fragment>,
    );
    expect(flat.map(({ node }) => React.isValidElement(node) && node.type)).toEqual([
      'span',
      'span',
    ]);
    render(
      <>
        {flat.map(({ key, node }) => (
          <React.Fragment key={key}>{node}</React.Fragment>
        ))}
      </>,
    );
    expect(calls).toEqual([]);
  });
});
