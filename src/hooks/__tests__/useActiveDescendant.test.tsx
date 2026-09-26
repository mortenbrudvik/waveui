import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  useActiveDescendant,
  type UseActiveDescendantOptions,
  type UseActiveDescendantResult,
} from '../useActiveDescendant';

/**
 * Renders one `useActiveDescendant` call and exposes its result through `resultRef`
 * (`useImperativeHandle`, as `useListbox.test.tsx`'s `Picker` does), so tests read the latest
 * result after a commit instead of reassigning a module-scope variable during render (which
 * `eslint-plugin-react-hooks` 7's purity rules reject, C-HOOKS). `onRender` is an optional probe
 * for render counts, the same pattern as that harness's `onRootRender`.
 */
interface ProbeProps extends Omit<UseActiveDescendantOptions, 'getId'> {
  getId?: (v: string) => string;
  resultRef?: React.RefObject<UseActiveDescendantResult | null>;
  onRender?: () => void;
}

function Probe({ resultRef, onRender, ...options }: ProbeProps) {
  onRender?.();
  const result = useActiveDescendant({ getId: (v) => `opt-${v}`, ...options });
  React.useImperativeHandle(resultRef, () => result);
  return (
    <ul>
      {options.items.map((v) => (
        <li key={v} id={`opt-${v}`} data-active={result.activeValue === v ? '' : undefined}>
          {v}
        </li>
      ))}
    </ul>
  );
}

const ABC = ['a', 'b', 'c'] as const;

describe('useActiveDescendant', () => {
  it('shows the fallback until an item is moved to, and nothing while disabled', () => {
    const ref = React.createRef<UseActiveDescendantResult>();
    const { rerender } = render(<Probe items={ABC} fallback="b" resultRef={ref} />);
    expect(ref.current!.activeValue).toBe('b');
    expect(ref.current!.activeDescendantId).toBe('opt-b');
    act(() => ref.current!.next());
    expect(ref.current!.activeValue).toBe('c');
    rerender(<Probe items={ABC} fallback="b" enabled={false} resultRef={ref} />);
    expect(ref.current!.activeValue).toBeNull();
    expect(ref.current!.activeDescendantId).toBeUndefined();
    rerender(<Probe items={ABC} fallback="b" resultRef={ref} />);
    expect(ref.current!.activeValue).toBe('b'); // the moved-to item was forgotten while disabled
  });

  it('ignores a fallback that is not an item', () => {
    const ref = React.createRef<UseActiveDescendantResult>();
    render(<Probe items={ABC} fallback="z" resultRef={ref} />);
    expect(ref.current!.activeValue).toBeNull();
  });

  it('drops a moved-to item that leaves the items, and does not bring it back', () => {
    const ref = React.createRef<UseActiveDescendantResult>();
    const { rerender } = render(<Probe items={ABC} resultRef={ref} />);
    act(() => ref.current!.setActiveValue('b'));
    rerender(<Probe items={['a', 'c']} resultRef={ref} />);
    expect(ref.current!.activeValue).toBeNull();
    rerender(<Probe items={ABC} resultRef={ref} />);
    expect(ref.current!.activeValue).toBeNull();
  });

  it('keeps a value set in the same update as the items it belongs to, and an invalid one clears an earlier move', () => {
    function Changer({
      resultRef,
    }: {
      resultRef: React.RefObject<UseActiveDescendantResult | null>;
    }) {
      const [items, setItems] = React.useState<readonly string[]>(ABC);
      const result = useActiveDescendant({ items, getId: (v) => v });
      React.useImperativeHandle(resultRef, () => result);
      return (
        <button
          type="button"
          onClick={() => {
            setItems(['c', 'd']); // TimePicker's pattern (spec §1.1.1): the next render's items
            result.setActiveValue('d');
          }}
        >
          change
        </button>
      );
    }
    const ref = React.createRef<UseActiveDescendantResult>();
    const { getByRole } = render(<Changer resultRef={ref} />);
    act(() => ref.current!.setActiveValue('b'));
    act(() => getByRole('button').click());
    expect(ref.current!.activeValue).toBe('d');
    act(() => ref.current!.setActiveValue('zz'));
    expect(ref.current!.activeValue).toBeNull();
  });

  it('keeps a move made in the same update that enables it', () => {
    function Opener({
      resultRef,
    }: {
      resultRef: React.RefObject<UseActiveDescendantResult | null>;
    }) {
      const [open, setOpen] = React.useState(false);
      const result = useActiveDescendant({ items: ABC, getId: (v) => v, enabled: open });
      React.useImperativeHandle(resultRef, () => result);
      return (
        <button
          type="button"
          onClick={() => {
            result.setActiveValue('c');
            setOpen(true);
          }}
        >
          open
        </button>
      );
    }
    const ref = React.createRef<UseActiveDescendantResult>();
    const { getByRole } = render(<Opener resultRef={ref} />);
    act(() => getByRole('button').click());
    expect(ref.current!.activeValue).toBe('c');
  });

  it('activates the first item when the items change while enabled (activateFirstOnChange)', () => {
    const ref = React.createRef<UseActiveDescendantResult>();
    const { rerender } = render(<Probe items={ABC} activateFirstOnChange resultRef={ref} />);
    expect(ref.current!.activeValue).toBeNull();
    act(() => ref.current!.setActiveValue('c'));
    rerender(<Probe items={['b', 'c']} activateFirstOnChange resultRef={ref} />);
    expect(ref.current!.activeValue).toBe('b'); // wins over the earlier move
    rerender(<Probe items={['b', 'c']} activateFirstOnChange enabled={false} resultRef={ref} />);
    rerender(<Probe items={['b', 'c']} activateFirstOnChange resultRef={ref} />);
    expect(ref.current!.activeValue).toBeNull(); // enabling with unchanged items keeps the fallback
  });

  it('adds no render without activateFirstOnChange', () => {
    const onRender = vi.fn();
    const { rerender } = render(<Probe items={ABC} onRender={onRender} />);
    rerender(<Probe items={['a', 'b']} onRender={onRender} />);
    expect(onRender).toHaveBeenCalledTimes(2);
  });

  it('steps from the fallback or from nothing, wraps with loop, clamps move', () => {
    const ref = React.createRef<UseActiveDescendantResult>();
    render(<Probe items={ABC} loop resultRef={ref} />);
    act(() => ref.current!.prev());
    expect(ref.current!.activeValue).toBe('c'); // from nothing: the last
    act(() => ref.current!.next());
    expect(ref.current!.activeValue).toBe('a'); // wraps
    act(() => ref.current!.move(10));
    expect(ref.current!.activeValue).toBe('c'); // clamps, never wraps
    act(() => ref.current!.setActiveValue(null));
    act(() => ref.current!.move(-10));
    expect(ref.current!.activeValue).toBe('c'); // from nothing: a negative delta goes to the last
  });

  it('scrolls keyboard moves into view, not pointer moves or scroll: false', () => {
    const spy = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = spy;
    try {
      const ref = React.createRef<UseActiveDescendantResult>();
      render(<Probe items={ABC} resultRef={ref} />);
      act(() => ref.current!.setActiveValue('b'));
      expect(spy).toHaveBeenCalledTimes(1);
      act(() => ref.current!.highlight('c'));
      act(() => ref.current!.setActiveValue('a', { scroll: false }));
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('prefers getElement over the id lookup for scrolling', () => {
    const target = document.createElement('div');
    target.scrollIntoView = vi.fn();
    const ref = React.createRef<UseActiveDescendantResult>();
    render(<Probe items={ABC} getElement={() => target} resultRef={ref} />);
    act(() => ref.current!.setActiveValue('b'));
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('reports each change once, null included, also in StrictMode', () => {
    const onChange = vi.fn();
    const ref = React.createRef<UseActiveDescendantResult>();
    const { rerender } = render(
      <React.StrictMode>
        <Probe items={ABC} fallback="a" onActiveValueChange={onChange} resultRef={ref} />
      </React.StrictMode>,
    );
    act(() => ref.current!.next());
    rerender(
      <React.StrictMode>
        <Probe
          items={ABC}
          fallback="a"
          enabled={false}
          onActiveValueChange={onChange}
          resultRef={ref}
        />
      </React.StrictMode>,
    );
    expect(onChange.mock.calls).toEqual([['a'], ['b'], [null]]);
  });

  it('puts the id in the server HTML and keeps method identities', () => {
    expect(renderToString(<Probe items={ABC} fallback="b" />)).toContain('data-active');
    const ref = React.createRef<UseActiveDescendantResult>();
    const { rerender } = render(<Probe items={ABC} resultRef={ref} />);
    const first = ref.current!.next;
    rerender(<Probe items={['a']} resultRef={ref} />);
    expect(ref.current!.next).toBe(first);
  });
});
