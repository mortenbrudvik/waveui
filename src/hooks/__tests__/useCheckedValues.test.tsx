import { afterEach, describe, it, expect, vi, expectTypeOf } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import {
  useCheckedValues,
  useDuplicatePairRegistry,
  withCheckedValuesListener,
  type CheckedValuesApi,
} from '../useCheckedValues';
import { __resetWarnings } from '../../lib/dev';
import type {
  CheckedValues,
  CheckedValuesChangeDetails,
  CheckedValuesChangeHandler,
} from '../../lib/types';

/** A click event, as a menu item passes its click's native event. */
function clickEvent(): Event {
  return new MouseEvent('click', { bubbles: true });
}

/**
 * Items bound to a checked-values state: checkbox-like buttons toggle, radio-like ones select.
 * Each button shows its state in `aria-pressed` and passes its click's native event.
 */
function Items({
  api,
  toggles = [],
  radios = [],
}: {
  api: CheckedValuesApi;
  toggles?: Array<[name: string, value: string]>;
  radios?: Array<[name: string, value: string]>;
}) {
  return (
    <>
      {toggles.map(([name, value]) => (
        <button
          key={`t-${name}-${value}`}
          type="button"
          aria-pressed={api.isChecked(name, value)}
          onClick={(event) => api.toggle(name, value, event.nativeEvent)}
        >
          {value}
        </button>
      ))}
      {radios.map(([name, value]) => (
        <button
          key={`r-${name}-${value}`}
          type="button"
          aria-pressed={api.isChecked(name, value)}
          onClick={(event) => api.select(name, value, event.nativeEvent)}
        >
          {value}
        </button>
      ))}
    </>
  );
}

function Uncontrolled({
  defaultCheckedValues,
  onCheckedValuesChange,
  toggles,
  radios,
}: {
  defaultCheckedValues?: CheckedValues;
  onCheckedValuesChange?: CheckedValuesChangeHandler;
  toggles?: Array<[string, string]>;
  radios?: Array<[string, string]>;
}) {
  const api = useCheckedValues(undefined, defaultCheckedValues, onCheckedValuesChange);
  return <Items api={api} toggles={toggles} radios={radios} />;
}

const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('useCheckedValues', () => {
  it('uncontrolled: toggle adds and removes a value, calling the handler once per change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<CheckedValuesChangeHandler>();
    render(
      <Uncontrolled
        onCheckedValuesChange={onChange}
        toggles={[
          ['view', 'ruler'],
          ['view', 'grid'],
        ]}
      />,
    );
    expect(pressed('ruler')).toBe('false');

    await user.click(screen.getByRole('button', { name: 'ruler' }));
    expect(pressed('ruler')).toBe('true');
    expect(onChange).toHaveBeenCalledTimes(1);
    const [values, details] = onChange.mock.calls[0];
    expect(values).toEqual({ view: ['ruler'] });
    expect(details).toEqual({
      name: 'view',
      checkedItems: ['ruler'],
      event: expect.any(MouseEvent),
    });
    expect(details!.event.type).toBe('click');

    await user.click(screen.getByRole('button', { name: 'grid' }));
    expect(onChange).toHaveBeenLastCalledWith(
      { view: ['ruler', 'grid'] },
      { name: 'view', checkedItems: ['ruler', 'grid'], event: expect.any(MouseEvent) },
    );

    await user.click(screen.getByRole('button', { name: 'ruler' }));
    expect(pressed('ruler')).toBe('false');
    expect(pressed('grid')).toBe('true');
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith(
      { view: ['grid'] },
      { name: 'view', checkedItems: ['grid'], event: expect.any(MouseEvent) },
    );
  });

  it('passes the event of the click that made the change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<CheckedValuesChangeHandler>();
    let clicked: Event | null = null;
    render(
      <div onClickCapture={(event) => (clicked = event.nativeEvent)}>
        <Uncontrolled onCheckedValuesChange={onChange} toggles={[['view', 'grid']]} />
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'grid' }));
    expect(onChange.mock.calls[0][1]!.event).toBe(clicked);
  });

  it('keeps the other groups, and the order of the remaining values, when a value is removed', () => {
    const onChange = vi.fn<CheckedValuesChangeHandler>();
    const { result } = renderHook(() =>
      useCheckedValues(undefined, { view: ['a', 'b', 'c'], sort: ['date'] }, onChange),
    );
    act(() => result.current.toggle('view', 'b', clickEvent()));
    expect(result.current.values).toEqual({ view: ['a', 'c'], sort: ['date'] });
    expect(onChange).toHaveBeenCalledWith(
      { view: ['a', 'c'], sort: ['date'] },
      expect.objectContaining({ name: 'view', checkedItems: ['a', 'c'] }),
    );
  });

  it('reads an unknown group as empty', () => {
    const { result } = renderHook(() => useCheckedValues(undefined, undefined, undefined));
    expect(result.current.values).toEqual({});
    expect(result.current.isChecked('view', 'grid')).toBe(false);
    act(() => result.current.toggle('view', 'grid', clickEvent()));
    expect(result.current.isChecked('view', 'grid')).toBe(true);
  });

  describe('group names that are Object.prototype keys', () => {
    const INHERITED = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'];

    it.each(INHERITED)('reads group %j as empty, and items of it render', (name) => {
      render(<Uncontrolled toggles={[[name, 'a']]} radios={[[name, 'b']]} />);
      expect(pressed('a')).toBe('false');
      expect(pressed('b')).toBe('false');
    });

    it.each(INHERITED)('toggles and selects in group %j as in any other group', async (name) => {
      const user = userEvent.setup();
      const onChange = vi.fn<CheckedValuesChangeHandler>();
      render(
        <Uncontrolled
          onCheckedValuesChange={onChange}
          toggles={[
            [name, 'a'],
            [name, 'b'],
          ]}
          radios={[[name, 'c']]}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'a' }));
      await user.click(screen.getByRole('button', { name: 'b' }));
      expect(pressed('a')).toBe('true');
      expect(pressed('b')).toBe('true');
      const [values, details] = onChange.mock.calls[1];
      // An own group of that name, not a prototype write.
      expect(Object.getPrototypeOf(values)).toBe(Object.prototype);
      expect(Object.keys(values)).toEqual([name]);
      expect(Object.getOwnPropertyDescriptor(values, name)?.value).toEqual(['a', 'b']);
      expect(details).toEqual({ name, checkedItems: ['a', 'b'], event: expect.any(MouseEvent) });
      expect(details!.checkedItems).toBe(Object.getOwnPropertyDescriptor(values, name)?.value);

      await user.click(screen.getByRole('button', { name: 'a' }));
      expect(pressed('a')).toBe('false');
      expect(Object.getOwnPropertyDescriptor(onChange.mock.calls[2][0], name)?.value).toEqual([
        'b',
      ]);

      await user.click(screen.getByRole('button', { name: 'c' }));
      expect(pressed('b')).toBe('false');
      expect(pressed('c')).toBe('true');
      expect(onChange).toHaveBeenCalledTimes(4);
      expect(onChange.mock.calls[3][1]).toEqual({
        name,
        checkedItems: ['c'],
        event: expect.any(MouseEvent),
      });
    });

    it('keeps an own "__proto__" group of the given values, and copies it as a group', () => {
      const onChange = vi.fn<CheckedValuesChangeHandler>();
      // JSON.parse makes "__proto__" an own key, as a stored state would be.
      const initial = JSON.parse('{"__proto__": ["a"], "view": ["grid"]}') as CheckedValues;
      const { result } = renderHook(() => useCheckedValues(undefined, initial, onChange));
      expect(result.current.isChecked('__proto__', 'a')).toBe(true);
      expect(result.current.isChecked('view', 'a')).toBe(false);

      act(() => result.current.toggle('view', 'ruler', clickEvent()));
      const [values] = onChange.mock.calls[0];
      expect(Object.getPrototypeOf(values)).toBe(Object.prototype);
      expect(Object.keys(values)).toEqual(['__proto__', 'view']);
      expect(Object.getOwnPropertyDescriptor(values, '__proto__')?.value).toEqual(['a']);
      expect(result.current.isChecked('__proto__', 'a')).toBe(true);
      expect(result.current.isChecked('view', 'ruler')).toBe(true);
    });
  });

  it('controlled: the rendered value follows the prop', () => {
    const { result, rerender } = renderHook(
      ({ values }: { values: CheckedValues }) => useCheckedValues(values, undefined, undefined),
      { initialProps: { values: { view: ['grid'] } } },
    );
    expect(result.current.isChecked('view', 'grid')).toBe(true);
    rerender({ values: { view: ['ruler'] } });
    expect(result.current.isChecked('view', 'grid')).toBe(false);
    expect(result.current.isChecked('view', 'ruler')).toBe(true);
    expect(result.current.values).toEqual({ view: ['ruler'] });
  });

  it('controlled: a parent that ignores the callback keeps its value, and each event starts from it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<CheckedValuesChangeHandler>();
    function Ignoring() {
      const api = useCheckedValues({ view: ['grid'] }, undefined, onChange);
      return <Items api={api} toggles={[['view', 'ruler']]} />;
    }
    render(<Ignoring />);
    await user.click(screen.getByRole('button', { name: 'ruler' }));
    await user.click(screen.getByRole('button', { name: 'ruler' }));
    expect(pressed('ruler')).toBe('false');
    expect(onChange).toHaveBeenCalledTimes(2);
    // Both clicks started from the rendered value, not from the value the first one emitted.
    expect(onChange.mock.calls.map(([values]) => values)).toEqual([
      { view: ['grid', 'ruler'] },
      { view: ['grid', 'ruler'] },
    ]);
  });

  it('controlled: a parent that stores the values renders them', async () => {
    const user = userEvent.setup();
    function Stateful() {
      const [values, setValues] = React.useState<Record<string, string[]>>({});
      // A state setter is a valid handler (it ignores the details).
      const api = useCheckedValues(values, undefined, setValues);
      return <Items api={api} toggles={[['view', 'grid']]} />;
    }
    render(<Stateful />);
    await user.click(screen.getByRole('button', { name: 'grid' }));
    expect(pressed('grid')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'grid' }));
    expect(pressed('grid')).toBe('false');
  });

  it('select makes a value the only one of its group; re-selecting it calls nothing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<CheckedValuesChangeHandler>();
    render(
      <Uncontrolled
        defaultCheckedValues={{ sort: ['name'], view: ['grid'] }}
        onCheckedValuesChange={onChange}
        radios={[
          ['sort', 'name'],
          ['sort', 'date'],
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'date' }));
    expect(pressed('date')).toBe('true');
    expect(pressed('name')).toBe('false');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      { sort: ['date'], view: ['grid'] },
      { name: 'sort', checkedItems: ['date'], event: expect.any(MouseEvent) },
    );

    await user.click(screen.getByRole('button', { name: 'date' }));
    expect(pressed('date')).toBe('true');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('select replaces a group that holds several values, also when one of them is the value', () => {
    const onChange = vi.fn<CheckedValuesChangeHandler>();
    const { result } = renderHook(() =>
      useCheckedValues(undefined, { sort: ['name', 'date'] }, onChange),
    );
    act(() => result.current.select('sort', 'date', clickEvent()));
    expect(result.current.values).toEqual({ sort: ['date'] });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('emits a new object with new arrays: mutating them does not change the next render', () => {
    const initial = { view: ['grid'], sort: ['name'] };
    const emitted: Array<Record<string, string[]>> = [];
    const { result } = renderHook(() =>
      useCheckedValues(undefined, initial, (values, details) => {
        emitted.push(values);
        values.view.push('mutated');
        values.sort.push('mutated');
        details?.checkedItems.push('mutated');
        values.added = ['mutated'];
      }),
    );
    act(() => result.current.toggle('view', 'ruler', clickEvent()));
    expect(result.current.values).toEqual({ view: ['grid', 'ruler'], sort: ['name'] });
    expect(initial).toEqual({ view: ['grid'], sort: ['name'] });
    expect(emitted[0]).not.toBe(result.current.values);
    act(() => result.current.toggle('sort', 'date', clickEvent()));
    expect(result.current.values).toEqual({ view: ['grid', 'ruler'], sort: ['name', 'date'] });
  });

  it('never mutates the controlled value, and accepts readonly data', () => {
    const controlled = Object.freeze({ view: Object.freeze(['grid']) }) satisfies CheckedValues;
    const onChange = vi.fn<CheckedValuesChangeHandler>();
    const { result } = renderHook(() => useCheckedValues(controlled, undefined, onChange));
    act(() => result.current.toggle('view', 'ruler', clickEvent()));
    act(() => result.current.select('sort', 'date', clickEvent()));
    expect(controlled).toEqual({ view: ['grid'] });
    expect(onChange.mock.calls[0][0]).toEqual({ view: ['grid', 'ruler'] });
    expect(onChange.mock.calls[0][0].view).not.toBe(controlled.view);
  });

  it('calls the handler once per change under StrictMode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<CheckedValuesChangeHandler>();
    render(
      <React.StrictMode>
        <Uncontrolled
          onCheckedValuesChange={onChange}
          toggles={[['view', 'grid']]}
          radios={[['sort', 'date']]}
        />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'grid' }));
    await user.click(screen.getByRole('button', { name: 'date' }));
    await user.click(screen.getByRole('button', { name: 'date' }));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(pressed('grid')).toBe('true');
    expect(pressed('date')).toBe('true');
  });

  it('chains two changes made in one event (both uncontrolled and controlled)', () => {
    for (const controlled of [false, true]) {
      const onChange = vi.fn<CheckedValuesChangeHandler>();
      const { result, unmount } = renderHook(() =>
        useCheckedValues(controlled ? { view: [] } : undefined, undefined, onChange),
      );
      act(() => {
        const event = clickEvent();
        result.current.toggle('view', 'a', event);
        result.current.toggle('view', 'b', event);
      });
      expect(onChange.mock.calls.map(([values]) => values)).toEqual([
        { view: ['a'] },
        { view: ['a', 'b'] },
      ]);
      expect(onChange.mock.calls[1][1]).toEqual(
        expect.objectContaining({ name: 'view', checkedItems: ['a', 'b'] }),
      );
      unmount();
    }
  });

  it('calls a request listener after the handler, with identical arguments, only on change', () => {
    const calls: string[] = [];
    const received: Array<[Record<string, string[]>, CheckedValuesChangeDetails | undefined]> = [];
    const { result } = renderHook(() =>
      useCheckedValues(undefined, { sort: ['name'] }, (values, details) => {
        calls.push('owner');
        received.push([values, details]);
      }),
    );
    const listener: CheckedValuesChangeHandler = (values, details) => {
      calls.push('listener');
      received.push([values, details]);
    };
    act(() => result.current.select('sort', 'date', clickEvent(), listener));
    expect(calls).toEqual(['owner', 'listener']);
    expect(received[1][0]).toBe(received[0][0]);
    expect(received[1][1]).toBe(received[0][1]);

    // An unchanged select calls neither.
    act(() => result.current.select('sort', 'date', clickEvent(), listener));
    expect(calls).toEqual(['owner', 'listener']);

    act(() => result.current.toggle('view', 'grid', clickEvent(), listener));
    expect(calls).toEqual(['owner', 'listener', 'owner', 'listener']);
  });

  it('calls the listener without an owner handler, with the details', () => {
    const listener = vi.fn<CheckedValuesChangeHandler>();
    const { result } = renderHook(() => useCheckedValues(undefined, undefined, undefined));
    const event = clickEvent();
    act(() => result.current.toggle('view', 'grid', event, listener));
    expect(listener).toHaveBeenCalledWith(
      { view: ['grid'] },
      { name: 'view', checkedItems: ['grid'], event },
    );
  });

  it('keeps the api object while the values do not change (C-MEMO)', () => {
    const { result, rerender } = renderHook(() => useCheckedValues(undefined, undefined, vi.fn()));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    act(() => result.current.toggle('view', 'grid', clickEvent()));
    expect(result.current).not.toBe(first);
    expect(result.current.toggle).toBe(first.toggle);
    expect(result.current.select).toBe(first.select);
  });

  it('has the documented types', () => {
    expectTypeOf(useCheckedValues).parameters.toEqualTypeOf<
      [CheckedValues | undefined, CheckedValues | undefined, CheckedValuesChangeHandler | undefined]
    >();
    expectTypeOf<CheckedValuesApi['values']>().toEqualTypeOf<CheckedValues>();
    expectTypeOf<CheckedValuesApi['toggle']>().toEqualTypeOf<
      (name: string, value: string, event: Event, listener?: CheckedValuesChangeHandler) => void
    >();
  });
});

describe('withCheckedValuesListener', () => {
  it('forwards to the api with its listener, after the owner handler', () => {
    const calls: string[] = [];
    const { result } = renderHook(() => {
      const owner = useCheckedValues(undefined, undefined, () => calls.push('owner'));
      const shared = React.useMemo(
        () => withCheckedValuesListener(owner, () => calls.push('submenu')),
        [owner],
      );
      return { owner, shared };
    });
    expect(result.current.shared.values).toBe(result.current.owner.values);
    act(() => result.current.shared.toggle('view', 'grid', clickEvent()));
    expect(calls).toEqual(['owner', 'submenu']);
    expect(result.current.shared.isChecked('view', 'grid')).toBe(true);
    expect(result.current.owner.isChecked('view', 'grid')).toBe(true);
  });

  it('nested twice calls the owner, then the outer listener, then the inner one, with the same arguments', () => {
    const calls: Array<[string, Record<string, string[]>, CheckedValuesChangeDetails | undefined]> =
      [];
    const record =
      (who: string): CheckedValuesChangeHandler =>
      (values, details) =>
        calls.push([who, values, details]);
    const { result } = renderHook(() => {
      const owner = useCheckedValues(undefined, { sort: ['name'] }, record('owner'));
      const outer = React.useMemo(() => withCheckedValuesListener(owner, record('outer')), [owner]);
      const inner = React.useMemo(() => withCheckedValuesListener(outer, record('inner')), [outer]);
      return inner;
    });
    act(() => result.current.select('sort', 'date', clickEvent()));
    expect(calls.map(([who]) => who)).toEqual(['owner', 'outer', 'inner']);
    expect(calls[1][1]).toBe(calls[0][1]);
    expect(calls[2][1]).toBe(calls[0][1]);
    expect(calls[2][2]).toBe(calls[0][2]);

    // No change, no call.
    act(() => result.current.select('sort', 'date', clickEvent()));
    expect(calls).toHaveLength(3);
  });

  it('passes a caller listener on after its own', () => {
    const calls: string[] = [];
    const { result } = renderHook(() => {
      const owner = useCheckedValues(undefined, undefined, undefined);
      return withCheckedValuesListener(owner, () => calls.push('submenu'));
    });
    act(() => result.current.toggle('view', 'grid', clickEvent(), () => calls.push('caller')));
    expect(calls).toEqual(['submenu', 'caller']);
  });
});

describe('useDuplicatePairRegistry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const KEY = 'Test:duplicate-value';
  const message = (name: string, value: string) =>
    `Test: "${name}" and "${value}" are registered twice.`;

  /** Registers its pair from an effect and unregisters in the cleanup, as an item does. */
  function Item({
    register,
    name,
    value,
  }: {
    register: (name: string, value: string) => () => void;
    name: string;
    value: string;
  }) {
    React.useEffect(() => register(name, value), [register, name, value]);
    return null;
  }

  /** One owner (a menu list, a toolbar) and its items. */
  function Owner({ pairs }: { pairs: Array<[name: string, value: string]> }) {
    const register = useDuplicatePairRegistry(KEY, message);
    return pairs.map(([name, value], index) => (
      <Item key={index} register={register} name={name} value={value} />
    ));
  }

  it('warns once, with the message for the pair, when a registered pair registers again', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useDuplicatePairRegistry(KEY, message));
    result.current('format', 'bold');
    result.current('format', 'italic');
    result.current('align', 'bold');
    expect(warn).not.toHaveBeenCalled();
    result.current('format', 'bold');
    // Warned once per key: a third registration, or a second duplicated pair, logs nothing more.
    result.current('format', 'bold');
    result.current('align', 'bold');
    expect(warn.mock.calls).toEqual([['[WaveUI] Test: "format" and "bold" are registered twice.']]);
  });

  it('keeps pairs whose parts contain commas or quotes apart', () => {
    const warn = vi.spyOn(console, 'warn');
    const { result } = renderHook(() => useDuplicatePairRegistry(KEY, message));
    result.current('a,b', 'c');
    result.current('a', 'b,c');
    result.current('"a"', 'b');
    result.current('a', '"b"');
    expect(warn).not.toHaveBeenCalled();
  });

  it('frees a pair when its registration is undone', () => {
    const warn = vi.spyOn(console, 'warn');
    const { result } = renderHook(() => useDuplicatePairRegistry(KEY, message));
    const unregister = result.current('format', 'bold');
    unregister();
    result.current('format', 'bold');
    expect(warn).not.toHaveBeenCalled();
  });

  it('counts per owner: the same pair in two owners does not warn, in StrictMode either', () => {
    const warn = vi.spyOn(console, 'warn');
    render(
      <React.StrictMode>
        <Owner pairs={[['format', 'bold']]} />
        <Owner pairs={[['format', 'bold']]} />
      </React.StrictMode>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns for two items of one owner; once one unmounts and the other moves away, the pair is free', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(
      <Owner
        pairs={[
          ['format', 'bold'],
          ['format', 'bold'],
        ]}
      />,
    );
    expect(warn.mock.calls).toEqual([['[WaveUI] Test: "format" and "bold" are registered twice.']]);
    // Forget the warning, so a pair that is still counted would warn again.
    warn.mockClear();
    __resetWarnings();
    rerender(<Owner pairs={[['format', 'bold']]} />);
    rerender(<Owner pairs={[['format', 'italic']]} />);
    rerender(<Owner pairs={[['format', 'bold']]} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it('counts nothing and logs nothing in production: every registration returns one no-op', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    // A copy of the module loaded in production: `isDev` is read once, when `lib/dev` loads.
    vi.resetModules();
    const production = await import('../useCheckedValues');
    const warn = vi.spyOn(console, 'warn');
    const { result } = renderHook(() => production.useDuplicatePairRegistry(KEY, message));
    const first = result.current('format', 'bold');
    // A counted registration returns its own cleanup; the production one is shared.
    expect(result.current('format', 'bold')).toBe(first);
    expect(result.current('align', 'italic')).toBe(first);
    expect(first()).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps its identity across renders while the key and the message do', () => {
    const { result, rerender } = renderHook(() => useDuplicatePairRegistry(KEY, message));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expectTypeOf(useDuplicatePairRegistry).parameters.toEqualTypeOf<
      [warnKey: string, message: (name: string, value: string) => string]
    >();
    expectTypeOf(first).toEqualTypeOf<(name: string, value: string) => () => void>();
  });
});
