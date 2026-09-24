import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import {
  ListboxContext,
  collectOptionLabels,
  markListboxElement,
  useListbox,
  useListboxOption,
  type ListboxItem,
  type UseListboxOptions,
  type UseListboxResult,
} from '../useListbox';

/* ------------------------------------------------------------------ */
/*  Stand-ins for P05's Option / OptionGroup                           */
/* ------------------------------------------------------------------ */

interface TestOptionProps extends Omit<React.LiHTMLAttributes<HTMLLIElement>, 'value'> {
  value: string;
  label?: string;
  textValue?: string;
  disabled?: boolean;
  onRender?: (value: string) => void;
  ref?: React.Ref<HTMLLIElement>;
}

function TestOptionImpl(props: TestOptionProps) {
  const { value, label, textValue, disabled, onRender, children, onClick, ref, ...rest } = props;
  onRender?.(value);
  const { optionProps } = useListboxOption(
    {
      value,
      label: label ?? (typeof children === 'string' ? children : undefined),
      textValue,
      disabled,
    },
    ref,
  );
  return (
    <li
      {...rest}
      {...optionProps}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) optionProps.onClick(e);
      }}
    >
      {children ?? value}
    </li>
  );
}
const Opt = markListboxElement(TestOptionImpl, 'option');
/** A memoized option (P05's options are memoized rows): it renders only when its props change. */
const MemoOpt = markListboxElement(React.memo(TestOptionImpl), 'option');

function TestGroupImpl({ label, children }: { label: string; children?: React.ReactNode }) {
  const id = React.useId();
  return (
    <li role="presentation">
      <div id={id} role="presentation">
        {label}
      </div>
      <ul role="group" aria-labelledby={id}>
        {children}
      </ul>
    </li>
  );
}
const Group = markListboxElement(TestGroupImpl, 'group');

/* ------------------------------------------------------------------ */
/*  Harness: a minimal Dropdown (select-only) / Combobox (editable)    */
/* ------------------------------------------------------------------ */

type HarnessOptions = Partial<
  Omit<UseListboxOptions, 'open' | 'onOpenChange' | 'selectedValues' | 'onSelect'>
>;

interface PickerProps extends HarnessOptions {
  children?: React.ReactNode;
  defaultValue?: string;
  defaultValues?: string[];
  defaultOpen?: boolean;
  /** Editable: filter options by the typed text. */
  filterByText?: boolean;
  /** While open, render the list in a portal (remounts the options). */
  portal?: boolean;
  onSelectSpy?: (value: string, item: ListboxItem) => void;
  onOpenChangeSpy?: (open: boolean, reason: string) => void;
  onRootRender?: () => void;
  resultRef?: React.RefObject<UseListboxResult | null>;
}

function Picker(props: PickerProps) {
  const {
    children,
    defaultValue = '',
    defaultValues,
    defaultOpen = false,
    filterByText = false,
    portal = false,
    mode = 'select-only',
    multiple = false,
    onSelectSpy,
    onOpenChangeSpy,
    onRootRender,
    resultRef,
    ...options
  } = props;
  onRootRender?.();
  const [value, setValue] = React.useState(defaultValue);
  const [values, setValues] = React.useState<string[]>(defaultValues ?? []);
  const [open, setOpen] = React.useState(defaultOpen);
  const [draft, setDraft] = React.useState<string | null>(null);
  const labels = collectOptionLabels(children);
  const filter = React.useMemo(
    () =>
      filterByText && draft
        ? (item: ListboxItem) => item.label.toLowerCase().includes(draft.toLowerCase())
        : undefined,
    [filterByText, draft],
  );
  const lb = useListbox({
    open,
    onOpenChange: (next, reason) => {
      setOpen(next);
      if (!next) setDraft(null);
      onOpenChangeSpy?.(next, reason);
    },
    mode,
    multiple,
    selectedValues: multiple ? values : value ? [value] : [],
    onSelect: (v, item) => {
      if (multiple)
        setValues((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
      else setValue(v);
      setDraft(null);
      onSelectSpy?.(v, item);
    },
    filter,
    ...options,
  });
  React.useImperativeHandle(resultRef, () => lb);
  const display = lb.getItem(value)?.label ?? labels.get(value) ?? '';
  const list = (
    <ul {...lb.getListboxProps()} aria-label="Fruits" hidden={!open}>
      {children}
    </ul>
  );
  return (
    <ListboxContext.Provider value={lb.context}>
      <div>
        {mode === 'select-only' ? (
          <button
            type="button"
            {...lb.getComboboxProps()}
            aria-label="Fruit"
            onClick={() => setOpen((o) => !o)}
            onKeyDown={lb.onKeyDown}
            onKeyUp={lb.onKeyUp}
          >
            {display || 'Select'}
          </button>
        ) : (
          <input
            {...lb.getComboboxProps()}
            aria-label="Fruit"
            value={draft ?? display}
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
            }}
            onKeyDown={lb.onKeyDown}
          />
        )}
        {portal && open ? createPortal(list, document.body) : list}
        <output data-testid="items">{lb.items.map((i) => i.value).join(',')}</output>
        <output data-testid="value">{multiple ? values.join(',') : value}</output>
      </div>
    </ListboxContext.Provider>
  );
}

const FRUITS = (
  <>
    <Opt value="a">Apple</Opt>
    <Opt value="b">Banana</Opt>
    <Opt value="c">Cherry</Opt>
    <Opt value="d">Date</Opt>
  </>
);

function combobox() {
  return screen.getByRole('combobox', { name: 'Fruit' });
}

function activeOption(): HTMLElement | null {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

function activeText(): string | null {
  return activeOption()?.textContent ?? null;
}

function key(k: string, init: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  act(() => {
    combobox().dispatchEvent(event);
  });
  return event;
}

function keyUp(k: string) {
  const event = new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true });
  act(() => {
    combobox().dispatchEvent(event);
  });
  return event;
}

function expanded(): boolean {
  return combobox().getAttribute('aria-expanded') === 'true';
}

/** A value outside React that nested components read, so they change without the root rendering. */
function createExternalValue<T>(initial: T) {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: () => current,
    set(next: T) {
      current = next;
      for (const listener of Array.from(listeners)) listener();
    },
  };
}

/** Memoized options in a nested component whose order an external value drives (no root render). */
function createReorderableOptions(initial: string[], onOptionRender?: (value: string) => void) {
  const order = createExternalValue(initial);
  function Options() {
    const values = React.useSyncExternalStore(order.subscribe, order.get);
    return (
      <>
        {values.map((v) => (
          <MemoOpt key={v} value={v} onRender={onOptionRender}>
            {v.toUpperCase()}
          </MemoOpt>
        ))}
      </>
    );
  }
  return { order, Options };
}

/**
 * Counts the store's item publishes (its internal `subscribeItems`). Root render counts cannot
 * show the batching contract — one publish per commit and per microtask — because React batches
 * the re-renders that a burst of publishes causes, and on mount the root subscribes only after the
 * options registered.
 */
function onItemsPublished(result: UseListboxResult | null, listener: () => void): () => void {
  const store = result?.context.store as unknown as
    | { subscribeItems?: (listener: () => void) => () => void }
    | undefined;
  if (typeof store?.subscribeItems !== 'function') throw new Error('no store.subscribeItems');
  return store.subscribeItems(listener);
}

/* ------------------------------------------------------------------ */
/*  collectOptionLabels                                                */
/* ------------------------------------------------------------------ */

describe('collectOptionLabels', () => {
  it('reads label → textValue → string children → value (no children)', () => {
    const labels = collectOptionLabels(
      <>
        <Opt value="a" label="Label A" textValue="Text A">
          Children A
        </Opt>
        <Opt value="b" textValue="Text B">
          Children B
        </Opt>
        <Opt value="c">Children C</Opt>
        <Opt value="d" />
      </>,
    );
    expect(Object.fromEntries(labels)).toEqual({
      a: 'Label A',
      b: 'Text B',
      c: 'Children C',
      d: 'd',
    });
  });

  it('recurses into OptionGroups, Fragments and arrays; custom wrappers are opaque', () => {
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <>{children}</>;
    }
    const labels = collectOptionLabels([
      <Group key="g" label="Europe">
        <>
          <Opt value="de">Germany</Opt>
        </>
        {[
          <Opt key="fr" value="fr">
            France
          </Opt>,
        ]}
      </Group>,
      <Wrapper key="w">
        <Opt value="hidden">Hidden</Opt>
      </Wrapper>,
      <li key="plain" value="1">
        Not an option
      </li>,
      null,
      false,
      'text',
    ]);
    expect(Object.fromEntries(labels)).toEqual({ de: 'Germany', fr: 'France' });
  });

  it('joins text of string/number children and intrinsic elements; first duplicate wins', () => {
    const labels = collectOptionLabels(
      <>
        <Opt value="us">
          <span aria-hidden="true">*</span> United {'States'}
        </Opt>
        <Opt value="n">{42}</Opt>
        <Opt value="us">Duplicate</Opt>
      </>,
    );
    expect(labels.get('us')).toBe('* United States');
    expect(labels.get('n')).toBe('42');
  });

  it('recognises marked memo components (memoized options)', () => {
    expect(Object.fromEntries(collectOptionLabels(<MemoOpt value="m">Memo</MemoOpt>))).toEqual({
      m: 'Memo',
    });
  });

  it('leaves out options whose children have no text (resolved later by registration)', () => {
    function Flag() {
      return <span>flag</span>;
    }
    expect(collectOptionLabels(<Opt value="x">{<Flag />}</Opt>).has('x')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Registration mode                                                  */
/* ------------------------------------------------------------------ */

describe('useListbox — registration mode (input-pickers#1)', () => {
  it('registers options in DOM order, including options nested in an OptionGroup', () => {
    render(
      <Picker>
        <Opt value="b">Banana</Opt>
        <Group label="Group">
          <Opt value="a">Apple</Opt>
        </Group>
        <Opt value="c">Cherry</Opt>
      </Picker>,
    );
    expect(screen.getByTestId('items')).toHaveTextContent('b,a,c');
  });

  it('places a later-inserted option at its DOM position', () => {
    function Dynamic({ withMiddle }: { withMiddle: boolean }) {
      return (
        <Picker>
          <Opt value="a">Apple</Opt>
          {withMiddle && <Opt value="m">Mango</Opt>}
          <Opt value="z">Zucchini</Opt>
        </Picker>
      );
    }
    const { rerender } = render(<Dynamic withMiddle={false} />);
    expect(screen.getByTestId('items')).toHaveTextContent('a,z');
    rerender(<Dynamic withMiddle />);
    expect(screen.getByTestId('items')).toHaveTextContent('a,m,z');
    rerender(<Dynamic withMiddle={false} />);
    expect(screen.getByTestId('items')).toHaveTextContent('a,z');
  });

  it('mounting 30 options renders the root twice (initial render + one publish)', () => {
    const onRootRender = vi.fn();
    render(
      <Picker onRootRender={onRootRender}>
        {Array.from({ length: 30 }, (_, i) => (
          <Opt key={i} value={`v${i}`}>{`Option ${i}`}</Opt>
        ))}
      </Picker>,
    );
    expect(screen.getByTestId('items').textContent?.split(',')).toHaveLength(30);
    expect(onRootRender).toHaveBeenCalledTimes(2);
  });

  it('publishes the registrations of one commit once, from the root layout effect', async () => {
    const ref = React.createRef<UseListboxResult>();
    function List({ count }: { count: number }) {
      return (
        <Picker resultRef={ref}>
          {Array.from({ length: count }, (_, i) => (
            <Opt key={i} value={`v${i}`}>{`Option ${i}`}</Opt>
          ))}
        </Picker>
      );
    }
    const { rerender } = render(<List count={0} />);
    const published = vi.fn();
    const unsubscribe = onItemsPublished(ref.current, published);
    try {
      rerender(<List count={30} />);
      // Synchronously in the commit (before any microtask), once for all 30 registrations.
      expect(published).toHaveBeenCalledTimes(1);
      expect(ref.current?.items).toHaveLength(30);
      await act(async () => {});
      expect(published).toHaveBeenCalledTimes(1);

      rerender(<List count={30} />); // re-rendered, unchanged options publish nothing
      await act(async () => {});
      expect(published).toHaveBeenCalledTimes(1);

      rerender(<List count={0} />); // 30 unregistrations, one publish
      expect(published).toHaveBeenCalledTimes(2);
      expect(ref.current?.items).toHaveLength(0);
    } finally {
      unsubscribe();
    }
  });

  it('coalesces additions made without a root render into one publish per microtask', async () => {
    const onRootRender = vi.fn();
    const ref = React.createRef<UseListboxResult>();
    // An external store drives the nested options, so they change without the root rendering.
    const count = createExternalValue(0);
    function More() {
      const current = React.useSyncExternalStore(count.subscribe, count.get);
      return (
        <>
          {Array.from({ length: current }, (_, i) => (
            <Opt key={i} value={`extra${i}`}>{`Extra ${i}`}</Opt>
          ))}
        </>
      );
    }
    render(
      <Picker onRootRender={onRootRender} resultRef={ref}>
        <Opt value="a">Apple</Opt>
        <More />
      </Picker>,
    );
    onRootRender.mockClear();
    const published = vi.fn();
    const unsubscribe = onItemsPublished(ref.current, published);
    try {
      await act(async () => {
        count.set(3);
      });
      expect(screen.getByTestId('items')).toHaveTextContent('a,extra0,extra1,extra2');
      expect(published).toHaveBeenCalledTimes(1);
      expect(onRootRender).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('re-sorts after a keyed reorder that keeps the same options (sort toggle)', () => {
    const ref = React.createRef<UseListboxResult>();
    function Sorted({ order }: { order: string[] }) {
      return (
        <Picker resultRef={ref}>
          {order.map((v) => (
            <Opt key={v} value={v}>
              {v.toUpperCase()}
            </Opt>
          ))}
        </Picker>
      );
    }
    const { rerender } = render(<Sorted order={['a', 'b', 'c']} />);
    expect(screen.getByTestId('items')).toHaveTextContent('a,b,c');
    rerender(<Sorted order={['c', 'b', 'a']} />);
    const onScreen = screen.getAllByRole('option', { hidden: true }).map((o) => o.textContent);
    expect(onScreen).toEqual(['C', 'B', 'A']);
    expect(ref.current?.items.map((i) => i.value)).toEqual(['c', 'b', 'a']);
    key('ArrowDown'); // opens on the first option on screen
    expect(activeText()).toBe('C');
    key('ArrowDown');
    expect(activeText()).toBe('B');
    key('End');
    expect(activeText()).toBe('A');
  });

  it('re-sorts after a reorder inside a nested component (the root does not render)', async () => {
    const onRootRender = vi.fn();
    const order = createExternalValue(['a', 'b', 'c']);
    function Options() {
      const values = React.useSyncExternalStore(order.subscribe, order.get);
      return (
        <>
          {values.map((v) => (
            <Opt key={v} value={v}>
              {v.toUpperCase()}
            </Opt>
          ))}
        </>
      );
    }
    render(
      <Picker onRootRender={onRootRender}>
        <Options />
      </Picker>,
    );
    onRootRender.mockClear();
    await act(async () => {
      order.set(['c', 'a', 'b']);
    });
    expect(screen.getByTestId('items')).toHaveTextContent('c,a,b');
    expect(onRootRender).toHaveBeenCalledTimes(1); // one publish for the new order
    key('ArrowDown');
    expect(activeText()).toBe('C');
  });

  it('re-sorts memoized options moved inside a nested component (neither options nor root render)', async () => {
    const onRootRender = vi.fn();
    const onOptionRender = vi.fn();
    const ref = React.createRef<UseListboxResult>();
    const { order, Options } = createReorderableOptions(['a', 'b', 'c'], onOptionRender);
    render(
      <Picker onRootRender={onRootRender} resultRef={ref}>
        <Options />
      </Picker>,
    );
    expect(ref.current?.items.map((i) => i.value)).toEqual(['a', 'b', 'c']);
    onRootRender.mockClear();
    onOptionRender.mockClear();
    await act(async () => {
      order.set(['c', 'a', 'b']);
    });
    expect(onOptionRender).not.toHaveBeenCalled(); // the move alone re-renders no option
    const onScreen = screen.getAllByRole('option', { hidden: true }).map((o) => o.textContent);
    expect(onScreen).toEqual(['C', 'A', 'B']);
    expect(ref.current?.items.map((i) => i.value)).toEqual(['c', 'a', 'b']);
    expect(onRootRender).toHaveBeenCalledTimes(1); // one publish for the new order
    key('ArrowDown');
    expect(activeText()).toBe('C');
    key('End');
    expect(activeText()).toBe('B');
  });

  it('keeps watching memoized options after the list remounts into a portal', async () => {
    const user = userEvent.setup();
    const ref = React.createRef<UseListboxResult>();
    const { order, Options } = createReorderableOptions(['a', 'b', 'c']);
    render(
      <Picker portal resultRef={ref}>
        <Options />
      </Picker>,
    );
    await user.click(combobox());
    expect(screen.getByRole('listbox', { name: 'Fruits' }).parentElement).toBe(document.body);
    expect(activeText()).toBe('A');
    await act(async () => {
      order.set(['c', 'a', 'b']);
    });
    expect(ref.current?.items.map((i) => i.value)).toEqual(['c', 'a', 'b']);
    expect(activeText()).toBe('C'); // autoHighlight: the first option in the new order
    key('ArrowDown');
    expect(activeText()).toBe('A');
  });

  it('re-sorts hoisted OptionGroup elements reordered by a nested component', async () => {
    const ref = React.createRef<UseListboxResult>();
    // Constant elements: React bails out of rendering them, so only the DOM moves.
    const groups: Record<string, React.ReactElement> = {
      fruit: (
        <Group key="fruit" label="Fruit">
          <Opt value="apple">Apple</Opt>
          <Opt value="pear">Pear</Opt>
        </Group>
      ),
      veg: (
        <Group key="veg" label="Vegetables">
          <Opt value="leek">Leek</Opt>
        </Group>
      ),
    };
    const order = createExternalValue(['fruit', 'veg']);
    function Groups() {
      const keys = React.useSyncExternalStore(order.subscribe, order.get);
      return <>{keys.map((k) => groups[k])}</>;
    }
    render(
      <Picker resultRef={ref}>
        <Groups />
      </Picker>,
    );
    expect(ref.current?.items.map((i) => i.value)).toEqual(['apple', 'pear', 'leek']);
    await act(async () => {
      order.set(['veg', 'fruit']);
    });
    expect(ref.current?.items.map((i) => i.value)).toEqual(['leek', 'apple', 'pear']);
    key('ArrowDown');
    expect(activeText()).toBe('Leek');
  });

  it('watches the option elements only while mounted, and not in data mode', () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    try {
      const { unmount } = render(<Picker>{FRUITS}</Picker>);
      expect(observe).toHaveBeenCalledTimes(1);
      const [target, init] = observe.mock.calls[0];
      expect(target).toBe(screen.getByRole('listbox', { hidden: true }));
      expect(init).toEqual({ childList: true, subtree: true });
      disconnect.mockClear();
      unmount();
      expect(disconnect).toHaveBeenCalled();

      observe.mockClear();
      render(<DataPicker items={ITEMS} defaultOpen />);
      expect(observe).not.toHaveBeenCalled();
    } finally {
      observe.mockRestore();
      disconnect.mockRestore();
    }
  });

  it('a highlight move checks no option order while the observer watches; a root reorder still re-sorts in the same commit', () => {
    const compare = vi.spyOn(Node.prototype, 'compareDocumentPosition');
    const ref = React.createRef<UseListboxResult>();
    const values = Array.from({ length: 50 }, (_, i) => `v${i}`);
    function Sorted({ order }: { order: string[] }) {
      return (
        <Picker defaultOpen autoHighlight={false} resultRef={ref}>
          {order.map((v) => (
            <MemoOpt key={v} value={v}>{`Option ${v}`}</MemoOpt>
          ))}
        </Picker>
      );
    }
    try {
      const { rerender } = render(<Sorted order={values} />);
      key('ArrowDown');
      compare.mockClear();
      key('ArrowDown');
      key('ArrowDown');
      expect(activeText()).toBe('Option v2');
      expect(compare).not.toHaveBeenCalled(); // O(1): no childList record, no order check

      rerender(<Sorted order={[...values].reverse()} />); // synchronous: no observer callback yet
      expect(ref.current?.items[0].value).toBe('v49');
      expect(ref.current?.items[49].value).toBe('v0');
      key('ArrowDown');
      expect(activeText()).toBe('Option v1');
    } finally {
      compare.mockRestore();
    }
  });

  it('without MutationObserver every root commit checks the order (a keyed reorder re-sorts)', () => {
    vi.stubGlobal('MutationObserver', undefined);
    const ref = React.createRef<UseListboxResult>();
    function Sorted({ order }: { order: string[] }) {
      return (
        <Picker resultRef={ref}>
          {order.map((v) => (
            <MemoOpt key={v} value={v}>
              {v.toUpperCase()}
            </MemoOpt>
          ))}
        </Picker>
      );
    }
    try {
      const { rerender } = render(<Sorted order={['a', 'b', 'c']} />);
      key('ArrowDown');
      key('Escape');
      rerender(<Sorted order={['c', 'b', 'a']} />);
      expect(ref.current?.items.map((i) => i.value)).toEqual(['c', 'b', 'a']);
      key('ArrowDown');
      expect(activeText()).toBe('C');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('warns once when the options of one listbox are split over two containers', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Breaks the consumer contract (§5.5): the inline list stays mounted next to the portal.
    function SplitPicker() {
      const lb = useListbox({
        open: true,
        onOpenChange: () => {},
        mode: 'select-only',
        selectedValues: [],
        onSelect: () => {},
      });
      return (
        <ListboxContext.Provider value={lb.context}>
          <ul {...lb.getListboxProps()} aria-label="Inline">
            <Opt value="split-x">X</Opt>
            <Opt value="split-y">Y</Opt>
          </ul>
          {createPortal(
            <ul role="listbox" aria-label="Portal">
              <Opt value="split-x">X</Opt>
              <Opt value="split-y">Y</Opt>
            </ul>,
            document.body,
          )}
        </ListboxContext.Provider>
      );
    }
    try {
      const { rerender } = render(<SplitPicker />);
      rerender(<SplitPicker />);
      const messages = warn.mock.calls.map((c) => String(c[0]));
      const split = messages.filter((m) => m.includes('single container'));
      expect(split).toHaveLength(1);
      expect(split[0]).toMatch(/^\[WaveUI\] /);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn about containers when the list moves between inline and portal', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    try {
      render(<Picker portal>{FRUITS}</Picker>);
      await user.click(combobox());
      await user.keyboard('{Escape}');
      await user.click(combobox());
      await act(async () => {});
      expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).not.toMatch(/container/);
    } finally {
      warn.mockRestore();
    }
  });

  it('warns once about duplicate option values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Picker>
        <Opt value="a">Apple</Opt>
        <Opt value="a">Apricot</Opt>
      </Picker>,
    );
    const messages = warn.mock.calls.map((c) => String(c[0]));
    expect(messages.filter((m) => m.includes('"a"'))).toHaveLength(1);
    expect(messages[0]).toMatch(/^\[WaveUI\] /);
    expect(screen.getByTestId('items')).toHaveTextContent(/^a$/);
    warn.mockRestore();
  });

  it('grouped options can be clicked and committed with ArrowDown + Enter; the trigger shows the label', async () => {
    const user = userEvent.setup();
    render(
      <Picker>
        <Group label="Fruit">
          <Opt value="a">Apple</Opt>
          <Opt value="b">Banana</Opt>
        </Group>
      </Picker>,
    );
    await user.click(combobox());
    await user.click(screen.getByRole('option', { name: 'Banana' }));
    expect(combobox()).toHaveTextContent('Banana');
    expect(expanded()).toBe(false);

    key('ArrowDown'); // opens on the selected option
    key('ArrowUp');
    key('Enter');
    expect(combobox()).toHaveTextContent('Apple');
  });

  it('reads the label from textContent when an option has no label, textValue or string child', () => {
    render(
      <Picker defaultOpen>
        <Opt value="x">
          <b>Bold</b> text
        </Opt>
      </Picker>,
    );
    key('ArrowDown');
    key('Enter');
    expect(combobox()).toHaveTextContent('Bold text');
  });

  it('re-reads a textContent label when the option re-renders with other text', () => {
    const ref = React.createRef<UseListboxResult>();
    function Dynamic({ text }: { text: string }) {
      return (
        <Picker defaultValue="x" resultRef={ref}>
          <Opt value="x">
            <b>{text}</b>
          </Opt>
          <Opt value="y">Other</Opt>
        </Picker>
      );
    }
    const { rerender } = render(<Dynamic text="One" />);
    expect(ref.current?.getItem('x')?.label).toBe('One');
    expect(combobox()).toHaveTextContent('One');
    rerender(<Dynamic text="Two" />);
    expect(ref.current?.getItem('x')?.label).toBe('Two');
    expect(combobox()).toHaveTextContent('Two');
  });
});

/* ------------------------------------------------------------------ */
/*  Ids, aria-activedescendant and element props                       */
/* ------------------------------------------------------------------ */

describe('useListbox — ids and aria-activedescendant (input-pickers#3)', () => {
  it('gives options `${listboxId}-opt-${n}` ids and sets aria-activedescendant only while open', () => {
    render(<Picker>{FRUITS}</Picker>);
    const box = combobox();
    const listbox = document.getElementById(box.getAttribute('aria-controls') ?? '');
    expect(listbox).toHaveAttribute('role', 'listbox');
    const listboxId = listbox?.id ?? '';
    const ids = Array.from(listbox?.querySelectorAll('[role="option"]') ?? []).map((o) => o.id);
    expect(ids).toEqual([0, 1, 2, 3].map((n) => `${listboxId}-opt-${n}`));
    expect(box).not.toHaveAttribute('aria-activedescendant');

    key('ArrowDown');
    expect(activeText()).toBe('Apple');
    key('ArrowDown');
    expect(activeText()).toBe('Banana');
    key('Escape');
    expect(box).not.toHaveAttribute('aria-activedescendant');
  });

  it('keeps ids stable across filtering', async () => {
    const user = userEvent.setup();
    render(
      <Picker mode="editable" filterByText>
        {FRUITS}
      </Picker>,
    );
    const before = Array.from(document.querySelectorAll('[role="option"]')).map((o) => o.id);
    await user.type(combobox(), 'an');
    expect(screen.getByTestId('items')).toHaveTextContent(/^b$/);
    await user.keyboard('{ArrowDown}');
    expect(activeOption()?.id).toBe(before[1]);
    await user.clear(combobox());
    const after = Array.from(document.querySelectorAll('[role="option"]')).map((o) => o.id);
    expect(after).toEqual(before);
  });

  it('keeps ids stable when the list remounts between inline (closed) and portal (open)', async () => {
    const user = userEvent.setup();
    render(<Picker portal>{FRUITS}</Picker>);
    const closedIds = Array.from(document.querySelectorAll('[role="option"]')).map((o) => o.id);
    await user.click(combobox());
    const listbox = screen.getByRole('listbox', { name: 'Fruits' });
    expect(listbox.parentElement).toBe(document.body);
    const openIds = screen.getAllByRole('option').map((o) => o.id);
    expect(openIds).toEqual(closedIds);
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Apple' }));
    key('ArrowDown');
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Banana' }));
  });

  it('combobox and listbox props follow the mode', () => {
    const ref = React.createRef<UseListboxResult>();
    const { rerender } = render(<Picker resultRef={ref}>{FRUITS}</Picker>);
    expect(ref.current?.getComboboxProps()).toEqual({
      role: 'combobox',
      'aria-expanded': false,
      'aria-controls': ref.current?.listboxId,
      'aria-haspopup': 'listbox',
    });
    expect(ref.current?.getListboxProps()).toMatchObject({
      id: ref.current?.listboxId,
      role: 'listbox',
      tabIndex: -1,
    });
    expect(ref.current?.getListboxProps()).not.toHaveProperty('aria-multiselectable');

    rerender(
      <Picker resultRef={ref} mode="editable" multiple idPrefix="tags">
        {FRUITS}
      </Picker>,
    );
    expect(ref.current?.listboxId).toMatch(/^tags-/);
    expect(ref.current?.getComboboxProps()).toMatchObject({ 'aria-autocomplete': 'list' });
    expect(ref.current?.getListboxProps()).toMatchObject({ 'aria-multiselectable': true });
  });

  it('the listbox keeps focus on the combobox on mouse down', () => {
    render(<Picker defaultOpen>{FRUITS}</Picker>);
    const event = fireEvent.mouseDown(screen.getByRole('option', { name: 'Apple' }));
    expect(event).toBe(false); // default prevented
  });
});

describe('useListbox — option state attributes (input-pickers#20)', () => {
  it('exposes aria-selected, aria-disabled and data-active/data-selected/data-disabled', () => {
    render(
      <Picker defaultValue="b" defaultOpen>
        <Opt value="a">Apple</Opt>
        <Opt value="b">Banana</Opt>
        <Opt value="c" disabled>
          Cherry
        </Opt>
      </Picker>,
    );
    const apple = screen.getByRole('option', { name: 'Apple' });
    const banana = screen.getByRole('option', { name: 'Banana' });
    const cherry = screen.getByRole('option', { name: 'Cherry' });
    expect(banana).toHaveAttribute('aria-selected', 'true');
    expect(banana).toHaveAttribute('data-selected', '');
    expect(banana).toHaveAttribute('data-active', ''); // autoHighlight: the selected option
    expect(apple).toHaveAttribute('aria-selected', 'false');
    expect(apple).not.toHaveAttribute('data-active');
    expect(apple).not.toHaveAttribute('data-selected');
    expect(cherry).toHaveAttribute('aria-disabled', 'true');
    expect(cherry).toHaveAttribute('data-disabled', '');
    expect(apple).not.toHaveAttribute('aria-disabled');
  });

  it('filtered-out options stay registered and render hidden', async () => {
    const user = userEvent.setup();
    render(
      <Picker mode="editable" filterByText>
        {FRUITS}
      </Picker>,
    );
    await user.type(combobox(), 'ch');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Cherry']);
    expect(document.querySelectorAll('[role="option"][hidden]')).toHaveLength(3);
  });

  it('pointer movement highlights enabled options only', () => {
    render(
      <Picker defaultOpen autoHighlight={false}>
        <Opt value="a">Apple</Opt>
        <Opt value="b" disabled>
          Banana
        </Opt>
      </Picker>,
    );
    fireEvent.pointerMove(screen.getByRole('option', { name: 'Banana' }));
    expect(activeOption()).toBeNull();
    fireEvent.pointerMove(screen.getByRole('option', { name: 'Apple' }));
    expect(activeText()).toBe('Apple');
  });
});

/* ------------------------------------------------------------------ */
/*  Derived active value                                               */
/* ------------------------------------------------------------------ */

describe('useListbox — one navigable list, derived active value (input-pickers#2, #26)', () => {
  it("type 'be', ArrowDown, Enter selects 'b' (highlight == commit in the filtered index space)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Picker mode="editable" filterByText autoHighlight={false} onSelectSpy={onSelect}>
        <Opt value="a">Alpha</Opt>
        <Opt value="b">Beta</Opt>
        <Opt value="c">Gamma</Opt>
      </Picker>,
    );
    await user.type(combobox(), 'be');
    expect(activeOption()).toBeNull();
    await user.keyboard('{ArrowDown}');
    expect(activeText()).toBe('Beta');
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('b', expect.objectContaining({ value: 'b' }));
    expect(combobox()).toHaveValue('Beta');
  });

  it('ArrowDown never moves past the last visible option', async () => {
    const user = userEvent.setup();
    render(
      <Picker mode="editable" filterByText autoHighlight={false}>
        <Opt value="a">Alpha</Opt>
        <Opt value="b">Beta</Opt>
        <Opt value="c">Bench</Opt>
        <Opt value="d">Delta</Opt>
      </Picker>,
    );
    await user.type(combobox(), 'be');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(activeText()).toBe('Bench');
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent('c');
  });

  it('autoHighlight: selected (default), first, false', () => {
    const { unmount } = render(
      <Picker defaultValue="c" defaultOpen>
        {FRUITS}
      </Picker>,
    );
    expect(activeText()).toBe('Cherry');
    unmount();
    const second = render(
      <Picker defaultValue="c" defaultOpen autoHighlight="first">
        {FRUITS}
      </Picker>,
    );
    expect(activeText()).toBe('Apple');
    second.unmount();
    render(
      <Picker defaultValue="c" defaultOpen autoHighlight={false}>
        {FRUITS}
      </Picker>,
    );
    expect(activeOption()).toBeNull();
  });

  it('the selected value falls back to the first option when it is not navigable', () => {
    render(
      <Picker defaultValue="zzz" defaultOpen>
        {FRUITS}
      </Picker>,
    );
    expect(activeText()).toBe('Apple');
  });

  it('drops an active option that leaves the navigable set: it is not active again when it returns', () => {
    const { rerender } = render(<DataPicker mode="select-only" items={ITEMS} defaultOpen />);
    key('ArrowDown');
    key('ArrowDown');
    expect(activeText()).toBe('Cherry');
    // An async update removes Cherry: the autoHighlight fallback (the first option) takes over.
    const withoutCherry = ITEMS.filter((item) => item.value !== 'c');
    rerender(<DataPicker mode="select-only" items={withoutCherry} defaultOpen />);
    expect(activeText()).toBe('Apple');
    // Cherry comes back: the highlight does not jump to it without a user action.
    rerender(<DataPicker mode="select-only" items={ITEMS} defaultOpen />);
    expect(activeText()).toBe('Apple');
    // The same when the active option is disabled and enabled again.
    key('ArrowDown');
    expect(activeText()).toBe('Banana');
    const bananaDisabled = ITEMS.map((item) =>
      item.value === 'b' ? { ...item, disabled: true } : item,
    );
    rerender(<DataPicker mode="select-only" items={bananaDisabled} defaultOpen />);
    expect(activeText()).toBe('Apple');
    rerender(<DataPicker mode="select-only" items={ITEMS} defaultOpen />);
    expect(activeText()).toBe('Apple');
  });

  it('editable: an option filtered out by a text change (no keystroke) is not active again when it returns', () => {
    const onSelect = vi.fn();
    render(
      <Picker mode="editable" filterByText autoHighlight={false} onSelectSpy={onSelect}>
        {FRUITS}
      </Picker>,
    );
    key('ArrowDown');
    key('ArrowDown');
    expect(activeText()).toBe('Banana');
    // A paste or drop from the context menu changes the text without a keydown.
    fireEvent.change(combobox(), { target: { value: 'ch' } });
    expect(activeOption()).toBeNull();
    fireEvent.change(combobox(), { target: { value: 'an' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Banana']);
    expect(activeOption()).toBeNull();
    expect(key('Enter').defaultPrevented).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('resets on close: reopening starts at the selected option again', () => {
    render(<Picker defaultValue="b">{FRUITS}</Picker>);
    key('ArrowDown');
    expect(activeText()).toBe('Banana');
    key('ArrowDown');
    key('ArrowDown');
    expect(activeText()).toBe('Date');
    key('Escape');
    key('ArrowDown');
    expect(activeText()).toBe('Banana');
  });

  it('highlightOnFilter: the first match becomes active while typing, not on open', async () => {
    const user = userEvent.setup();
    render(
      <Picker mode="editable" filterByText highlightOnFilter defaultValue="d">
        <Opt value="a">Alpha</Opt>
        <Opt value="b">Beta</Opt>
        <Opt value="c">Bench</Opt>
        <Opt value="d">Delta</Opt>
      </Picker>,
    );
    key('ArrowDown');
    expect(activeText()).toBe('Delta');
    await user.clear(combobox());
    await user.type(combobox(), 'e');
    // 'e' matches Beta, Bench and Delta; the selected Delta still matches, the first match wins.
    expect(activeText()).toBe('Beta');
    await user.type(combobox(), 'n');
    expect(activeText()).toBe('Bench');
  });

  it('highlightOnFilter: the keystroke that opens the listbox highlights the first match', async () => {
    const user = userEvent.setup();
    render(
      <Picker mode="editable" filterByText highlightOnFilter defaultValue="d">
        <Opt value="a">Alpha</Opt>
        <Opt value="b">Beta</Opt>
        <Opt value="c">Bench</Opt>
        <Opt value="d">Delta</Opt>
      </Picker>,
    );
    expect(expanded()).toBe(false);
    // Replace the shown "Delta" with "e" while closed: the change opens the listbox and filters it
    // in one update. The selected Delta still matches; the first match wins.
    await user.type(combobox(), 'e', { initialSelectionStart: 0, initialSelectionEnd: 5 });
    expect(expanded()).toBe(true);
    expect(activeText()).toBe('Beta');

    // Opening without a filter change still starts at the selected option.
    key('Escape'); // closes; the harness drops the draft
    key('ArrowDown');
    expect(activeText()).toBe('Delta');
  });

  it('highlightOnFilter: a keystroke that keeps the navigable set highlights the first match', async () => {
    const user = userEvent.setup();
    render(
      <Picker mode="editable" filterByText highlightOnFilter autoHighlight={false}>
        <Opt value="u">Blueberry</Opt>
        <Opt value="a">Blackberry</Opt>
        <Opt value="c">Cherry</Opt>
      </Picker>,
    );
    await user.type(combobox(), 'b');
    expect(activeText()).toBe('Blueberry');
    await user.keyboard('{ArrowDown}');
    expect(activeText()).toBe('Blackberry');
    // 'be' matches the same two options: the edit still moves the highlight to the first match.
    await user.keyboard('e');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Blueberry',
      'Blackberry',
    ]);
    expect(activeText()).toBe('Blueberry');
  });

  it('highlightOnFilter with an inline (unmemoized) filter neither loops nor resets on arrows', () => {
    function InlineFilter({ query }: { query: string }) {
      const [open, setOpen] = React.useState(true);
      const lb = useListbox({
        open,
        onOpenChange: setOpen,
        mode: 'editable',
        selectedValues: [],
        onSelect: () => {},
        items: ITEMS,
        filter: (item) => item.label.toLowerCase().includes(query), // new function every render
        highlightOnFilter: true,
      });
      return (
        <ListboxContext.Provider value={lb.context}>
          <input {...lb.getComboboxProps()} aria-label="Fruit" onKeyDown={lb.onKeyDown} readOnly />
          <ul {...lb.getListboxProps()} aria-label="Fruits">
            {lb.items.map((item) => (
              <Row key={item.value} item={item} />
            ))}
          </ul>
        </ListboxContext.Provider>
      );
    }
    const { rerender } = render(<InlineFilter query="a" />);
    expect(activeText()).toBe('Apple');
    key('ArrowDown');
    expect(activeText()).toBe('Banana');
    rerender(<InlineFilter query="a" />); // same result set: the highlight stays
    expect(activeText()).toBe('Banana');
    rerender(<InlineFilter query="da" />);
    expect(activeText()).toBe('Date');
  });
});

/* ------------------------------------------------------------------ */
/*  Data mode                                                          */
/* ------------------------------------------------------------------ */

const Row = React.memo(function Row({
  item,
  onRender,
}: {
  item: ListboxItem;
  onRender?: (value: string) => void;
}) {
  onRender?.(item.value);
  const { optionProps } = useListboxOption({
    value: item.value,
    label: item.label,
    disabled: item.disabled,
  });
  return <li {...optionProps}>{item.label}</li>;
});

interface DataPickerProps extends HarnessOptions {
  items: readonly ListboxItem[];
  defaultOpen?: boolean;
  onRowRender?: (value: string) => void;
  onSelectSpy?: (value: string, item: ListboxItem) => void;
  /** React key of a row. @default the item value */
  rowKey?: (item: ListboxItem, index: number) => string;
}

function DataPicker({
  items,
  defaultOpen = false,
  onRowRender,
  onSelectSpy,
  rowKey = (item) => item.value,
  mode = 'editable',
  ...options
}: DataPickerProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [value, setValue] = React.useState('');
  const lb = useListbox({
    open,
    onOpenChange: setOpen,
    mode,
    selectedValues: value ? [value] : [],
    onSelect: (v, item) => {
      setValue(v);
      onSelectSpy?.(v, item);
    },
    items,
    ...options,
  });
  return (
    <ListboxContext.Provider value={lb.context}>
      <input {...lb.getComboboxProps()} aria-label="Fruit" onKeyDown={lb.onKeyDown} readOnly />
      <ul {...lb.getListboxProps()} aria-label="Fruits" hidden={!open}>
        {lb.items.map((item, index) => (
          <Row key={rowKey(item, index)} item={item} onRender={onRowRender} />
        ))}
      </ul>
      <output data-testid="value">{value}</output>
    </ListboxContext.Provider>
  );
}

const ITEMS: ListboxItem[] = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry' },
  { value: 'd', label: 'Date' },
];

describe('useListbox — data mode', () => {
  it('async shrink: the active value falls back and Enter still commits an existing option', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <DataPicker items={ITEMS} defaultOpen autoHighlight={false} onSelectSpy={onSelect} />,
    );
    key('ArrowDown');
    key('ArrowDown');
    key('ArrowDown');
    expect(activeText()).toBe('Cherry');
    rerender(
      <DataPicker
        items={ITEMS.slice(0, 1)}
        defaultOpen
        autoHighlight={false}
        onSelectSpy={onSelect}
      />,
    );
    // autoHighlight=false: nothing active any more, the activedescendant never dangles.
    expect(combobox()).not.toHaveAttribute('aria-activedescendant');
    key('ArrowDown');
    expect(activeText()).toBe('Apple');
    key('Enter');
    expect(onSelect).toHaveBeenCalledWith('a', ITEMS[0]);
  });

  it('async shrink with autoHighlight: the activedescendant points at an existing option', () => {
    const { rerender } = render(<DataPicker items={ITEMS} defaultOpen />);
    key('ArrowDown');
    key('ArrowDown');
    expect(activeText()).toBe('Cherry');
    rerender(<DataPicker items={[ITEMS[1]]} defaultOpen />);
    expect(activeOption()).toBe(screen.getByRole('option', { name: 'Banana' }));
    key('Enter');
    expect(screen.getByTestId('value')).toHaveTextContent('b');
  });

  it('onSelect receives the consumer’s item object', () => {
    const onSelect = vi.fn();
    render(<DataPicker items={ITEMS} defaultOpen onSelectSpy={onSelect} />);
    fireEvent.click(screen.getByRole('option', { name: 'Date' }));
    expect(onSelect).toHaveBeenCalledWith('d', ITEMS[3]);
  });

  it('warns about duplicate item values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Not mocked: an unexpected error still prints. The rows get unique React keys, so the only
    // duplicate is the item value under test (no React duplicate-key error).
    const error = vi.spyOn(console, 'error');
    try {
      render(
        <DataPicker
          items={[...ITEMS, { value: 'a', label: 'Again' }]}
          rowKey={(item, index) => `${index}:${item.value}`}
        />,
      );
      expect(warn.mock.calls.filter((c) => String(c[0]).includes('"a"'))).toHaveLength(1);
      expect(error).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Render counts (input-pickers#27)                                   */
/* ------------------------------------------------------------------ */

describe('useListbox — store selectors (input-pickers#27)', () => {
  it('registration mode: ArrowDown re-renders only the old and the new active option', () => {
    const onRender = vi.fn();
    render(
      <Picker defaultOpen autoHighlight={false}>
        {Array.from({ length: 20 }, (_, i) => (
          <Opt key={i} value={`v${i}`} onRender={onRender}>{`Option ${i}`}</Opt>
        ))}
      </Picker>,
    );
    key('ArrowDown');
    onRender.mockClear();
    key('ArrowDown');
    expect(onRender.mock.calls.map((c) => c[0]).sort()).toEqual(['v0', 'v1']);
  });

  it('data mode with memoized rows: ArrowDown re-renders two rows', () => {
    const onRowRender = vi.fn();
    render(
      <DataPicker items={ITEMS} defaultOpen autoHighlight={false} onRowRender={onRowRender} />,
    );
    key('ArrowDown');
    onRowRender.mockClear();
    key('ArrowDown');
    expect(onRowRender.mock.calls.map((c) => c[0]).sort()).toEqual(['a', 'b']);
  });
});

/* ------------------------------------------------------------------ */
/*  Select-only keyboard (input-pickers#11)                            */
/* ------------------------------------------------------------------ */

describe('useListbox — select-only keys (APG)', () => {
  it('ArrowDown opens on the selected option (first when nothing is selected)', () => {
    const { unmount } = render(<Picker defaultValue="c">{FRUITS}</Picker>);
    expect(key('ArrowDown').defaultPrevented).toBe(true);
    expect(expanded()).toBe(true);
    expect(activeText()).toBe('Cherry');
    unmount();
    render(<Picker>{FRUITS}</Picker>);
    key('ArrowDown');
    expect(activeText()).toBe('Apple');
  });

  it('ArrowUp opens on the selected option (last when nothing is selected)', () => {
    const { unmount } = render(<Picker defaultValue="b">{FRUITS}</Picker>);
    key('ArrowUp');
    expect(activeText()).toBe('Banana');
    unmount();
    render(<Picker>{FRUITS}</Picker>);
    key('ArrowUp');
    expect(expanded()).toBe(true);
    expect(activeText()).toBe('Date');
  });

  it('ArrowDown/ArrowUp move while open; loop=false stops at the ends, loop=true wraps', () => {
    const { unmount } = render(<Picker>{FRUITS}</Picker>);
    key('ArrowUp'); // Date
    key('ArrowDown');
    expect(activeText()).toBe('Date');
    key('ArrowUp');
    expect(activeText()).toBe('Cherry');
    unmount();
    render(<Picker loop>{FRUITS}</Picker>);
    key('ArrowUp'); // Date
    key('ArrowDown');
    expect(activeText()).toBe('Apple');
    key('ArrowUp');
    expect(activeText()).toBe('Date');
  });

  it('Home and End open and move to the first/last option', () => {
    render(<Picker defaultValue="b">{FRUITS}</Picker>);
    expect(key('End').defaultPrevented).toBe(true);
    expect(expanded()).toBe(true);
    expect(activeText()).toBe('Date');
    key('Home');
    expect(activeText()).toBe('Apple');
  });

  it('PageDown/PageUp jump by 10 options, clamped', () => {
    render(
      <Picker defaultOpen autoHighlight="first">
        {Array.from({ length: 25 }, (_, i) => (
          <Opt key={i} value={`v${i}`}>{`Option ${i}`}</Opt>
        ))}
      </Picker>,
    );
    key('PageDown');
    expect(activeText()).toBe('Option 10');
    key('PageDown');
    key('PageDown');
    expect(activeText()).toBe('Option 24');
    key('PageUp');
    expect(activeText()).toBe('Option 14');
  });

  it('typeahead opens the listbox and positions on the match; repeated letters cycle', () => {
    vi.useFakeTimers();
    try {
      render(
        <Picker>
          <Opt value="a">Apple</Opt>
          <Opt value="b">Banana</Opt>
          <Opt value="bl">Blueberry</Opt>
          <Opt value="c">Cherry</Opt>
        </Picker>,
      );
      expect(key('c').defaultPrevented).toBe(true);
      expect(expanded()).toBe(true);
      expect(activeText()).toBe('Cherry');
      act(() => vi.advanceTimersByTime(600)); // the typeahead buffer resets
      key('b');
      expect(activeText()).toBe('Banana');
      key('b');
      expect(activeText()).toBe('Blueberry');
      act(() => vi.advanceTimersByTime(600));
      key('b');
      key('l');
      expect(activeText()).toBe('Blueberry');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Space during a typeahead search is part of the search, not a commit', () => {
    const onSelect = vi.fn();
    render(
      <Picker onSelectSpy={onSelect}>
        <Opt value="n">New Mexico</Opt>
        <Opt value="ny">New York</Opt>
      </Picker>,
    );
    key('n');
    key('e');
    key('w');
    expect(key(' ').defaultPrevented).toBe(true);
    key('y');
    expect(activeText()).toBe('New York');
    expect(onSelect).not.toHaveBeenCalled();
    expect(expanded()).toBe(true);
  });

  it('a printable key without a match still opens the listbox', () => {
    render(<Picker>{FRUITS}</Picker>);
    key('x');
    expect(expanded()).toBe(true);
  });

  it('Space after an unmatched typeahead prefix does not commit', () => {
    const onSelect = vi.fn();
    render(
      <Picker onSelectSpy={onSelect}>
        <Opt value="cat">Cat</Opt>
        <Opt value="dog">Dog</Opt>
      </Picker>,
    );
    key('c');
    expect(key(' ').defaultPrevented).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
    expect(expanded()).toBe(true);
  });

  it('Enter and Space open, then commit the active option and close', () => {
    const onSelect = vi.fn();
    render(<Picker onSelectSpy={onSelect}>{FRUITS}</Picker>);
    expect(key('Enter').defaultPrevented).toBe(true);
    expect(expanded()).toBe(true);
    key('ArrowDown');
    expect(key('Enter').defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith('b', expect.objectContaining({ label: 'Banana' }));
    expect(expanded()).toBe(false);

    expect(key(' ').defaultPrevented).toBe(true);
    expect(expanded()).toBe(true);
    key('ArrowDown');
    expect(key(' ').defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith('c', expect.objectContaining({ label: 'Cherry' }));
    expect(expanded()).toBe(false);
  });

  it('button combobox: Space keyup is prevented so the native click does not toggle again', () => {
    render(<Picker>{FRUITS}</Picker>);
    expect(keyUp(' ').defaultPrevented).toBe(true);
    expect(keyUp('Enter').defaultPrevented).toBe(false);
  });

  it('button combobox (real keyboard): Enter/Space commit without re-opening via click', async () => {
    const user = userEvent.setup();
    render(<Picker>{FRUITS}</Picker>);
    combobox().focus();
    await user.keyboard('{Enter}');
    expect(expanded()).toBe(true);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent('b');
    expect(expanded()).toBe(false);
    await user.keyboard(' ');
    expect(expanded()).toBe(true);
    await user.keyboard('{ArrowDown} ');
    expect(screen.getByTestId('value')).toHaveTextContent('c');
    expect(expanded()).toBe(false);
  });

  it('Alt+ArrowDown opens without moving; Alt+ArrowUp commits and closes', () => {
    const onOpenChange = vi.fn();
    render(
      <Picker defaultValue="b" onOpenChangeSpy={onOpenChange}>
        {FRUITS}
      </Picker>,
    );
    key('ArrowDown', { altKey: true });
    expect(expanded()).toBe(true);
    expect(activeText()).toBe('Banana');
    key('ArrowDown');
    key('ArrowUp', { altKey: true });
    expect(expanded()).toBe(false);
    expect(screen.getByTestId('value')).toHaveTextContent('c');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'select');
  });

  it('Tab commits the active option and closes without preventing the focus move', () => {
    const onOpenChange = vi.fn();
    render(<Picker onOpenChangeSpy={onOpenChange}>{FRUITS}</Picker>);
    key('ArrowDown');
    key('ArrowDown');
    expect(key('Tab').defaultPrevented).toBe(false);
    expect(screen.getByTestId('value')).toHaveTextContent('b');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'tab');
  });

  it('Escape closes (prevented); with the listbox closed it is left alone', () => {
    const onOpenChange = vi.fn();
    render(<Picker onOpenChangeSpy={onOpenChange}>{FRUITS}</Picker>);
    key('ArrowDown');
    expect(key('Escape').defaultPrevented).toBe(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'escape');
    expect(key('Escape').defaultPrevented).toBe(false);
  });

  it('ignores keys a consumer handler already prevented, modifier chords and IME composition', () => {
    render(<Picker>{FRUITS}</Picker>);
    const prevented = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    prevented.preventDefault();
    act(() => {
      combobox().dispatchEvent(prevented);
    });
    expect(expanded()).toBe(false);
    key('ArrowDown', { ctrlKey: true });
    expect(expanded()).toBe(false);
    key('ArrowDown', { isComposing: true });
    expect(expanded()).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Editable keyboard                                                  */
/* ------------------------------------------------------------------ */

describe('useListbox — editable keys (APG)', () => {
  it('ArrowDown/ArrowUp open on the selected option, else the first/last', () => {
    const { unmount } = render(<Picker mode="editable">{FRUITS}</Picker>);
    key('ArrowDown');
    expect(expanded()).toBe(true);
    expect(activeText()).toBe('Apple');
    key('Escape');
    key('ArrowUp');
    expect(activeText()).toBe('Date');
    unmount();
    render(
      <Picker mode="editable" defaultValue="b">
        {FRUITS}
      </Picker>,
    );
    key('ArrowUp');
    expect(activeText()).toBe('Banana');
  });

  it('Alt+ArrowDown opens without moving (autoHighlight decides)', () => {
    render(
      <Picker mode="editable" autoHighlight={false}>
        {FRUITS}
      </Picker>,
    );
    key('ArrowDown', { altKey: true });
    expect(expanded()).toBe(true);
    expect(activeOption()).toBeNull();
  });

  it('Home/End/PageUp and printable keys are left to the text input', () => {
    render(
      <Picker mode="editable" defaultOpen>
        {FRUITS}
      </Picker>,
    );
    expect(key('Home').defaultPrevented).toBe(false);
    expect(key('End').defaultPrevented).toBe(false);
    expect(key('PageDown').defaultPrevented).toBe(false);
    expect(key('b').defaultPrevented).toBe(false);
  });

  it('typing returns visual focus to the textbox, also when the active option still matches (APG)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Picker mode="editable" filterByText autoHighlight={false} onSelectSpy={onSelect}>
        {FRUITS}
      </Picker>,
    );
    combobox().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeText()).toBe('Banana');
    await user.keyboard('b');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Banana']);
    expect(activeOption()).toBeNull();
    await user.keyboard('{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
    expect(expanded()).toBe(true);
  });

  it('an option filtered out while typing is not active again after Backspace brings it back', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Picker mode="editable" multiple filterByText autoHighlight={false} onSelectSpy={onSelect}>
        <Opt value="a">Apple</Opt>
        <Opt value="b">Banana</Opt>
        <Opt value="bl">Blueberry</Opt>
        <Opt value="c">Cherry</Opt>
      </Picker>,
    );
    combobox().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeText()).toBe('Banana');
    await user.keyboard('bl');
    expect(activeOption()).toBeNull();
    await user.keyboard('{Backspace}');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Banana',
      'Blueberry',
    ]);
    expect(activeOption()).toBeNull();
    await user.keyboard('{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('text-editing keys clear the highlight without preventing them; other keys keep it', () => {
    render(
      <Picker mode="editable" defaultOpen autoHighlight={false}>
        {FRUITS}
      </Picker>,
    );
    const clearing: Array<[string, Partial<KeyboardEventInit>]> = [
      ['x', {}],
      [' ', {}],
      ['X', { shiftKey: true }],
      ['Backspace', {}],
      ['Backspace', { ctrlKey: true }],
      ['Delete', {}],
      ['v', { ctrlKey: true }], // paste
      ['x', { metaKey: true }], // cut
      ['z', { ctrlKey: true }], // undo
      ['y', { ctrlKey: true }], // redo
      ['@', { ctrlKey: true, altKey: true }], // AltGr
      ['Unidentified', {}], // virtual keyboards
    ];
    for (const [k, init] of clearing) {
      key('ArrowDown');
      key('ArrowDown');
      expect(activeText()).toBe('Banana');
      expect(key(k, init).defaultPrevented, k).toBe(false);
      expect(activeOption(), `${k} ${JSON.stringify(init)}`).toBeNull();
    }
    key('ArrowDown');
    key('ArrowDown');
    const keeping: Array<[string, Partial<KeyboardEventInit>]> = [
      ['c', { ctrlKey: true }], // copy
      ['a', { metaKey: true }], // select all
      ['Shift', { shiftKey: true }],
      ['ArrowLeft', {}],
      ['Home', {}],
      ['F2', {}],
    ];
    for (const [k, init] of keeping) {
      key(k, init);
      expect(activeText(), `${k} ${JSON.stringify(init)}`).toBe('Banana');
    }
  });

  it('text keys in a read-only input keep the highlight (the text cannot change)', () => {
    render(<DataPicker items={ITEMS} defaultOpen autoHighlight={false} />);
    key('ArrowDown');
    key('ArrowDown');
    expect(activeText()).toBe('Banana');
    key('x');
    key('Backspace');
    expect(activeText()).toBe('Banana');
  });

  it('Enter commits the active option; with the listbox closed Enter submits the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form aria-label="Order" onSubmit={onSubmit}>
        <Picker mode="editable">{FRUITS}</Picker>
        <button type="submit">Submit</button>
      </form>,
    );
    combobox().focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent('b');
    expect(expanded()).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('Enter with the listbox open but nothing active is left to the consumer', () => {
    render(
      <Picker mode="editable" defaultOpen autoHighlight={false}>
        {FRUITS}
      </Picker>,
    );
    expect(key('Enter').defaultPrevented).toBe(false);
    expect(expanded()).toBe(true);
  });

  it('Escape closes (prevented); closed with text present it calls onClearDraft', () => {
    const onClearDraft = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <Picker
        mode="editable"
        defaultValue="a"
        onClearDraft={onClearDraft}
        onOpenChangeSpy={onOpenChange}
      >
        {FRUITS}
      </Picker>,
    );
    key('ArrowDown');
    expect(key('Escape').defaultPrevented).toBe(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'escape');
    expect(onClearDraft).not.toHaveBeenCalled();
    expect(combobox()).toHaveValue('Apple');
    expect(key('Escape').defaultPrevented).toBe(true);
    expect(onClearDraft).toHaveBeenCalledTimes(1);
  });

  it('closed Escape is left alone when the input is empty or onClearDraft is not given', () => {
    const { unmount } = render(
      <Picker mode="editable" onClearDraft={() => {}}>
        {FRUITS}
      </Picker>,
    );
    expect(key('Escape').defaultPrevented).toBe(false);
    unmount();
    render(
      <Picker mode="editable" defaultValue="a">
        {FRUITS}
      </Picker>,
    );
    expect(key('Escape').defaultPrevented).toBe(false);
  });

  it('Tab closes the listbox without committing', () => {
    const onOpenChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <Picker mode="editable" onOpenChangeSpy={onOpenChange} onSelectSpy={onSelect}>
        {FRUITS}
      </Picker>,
    );
    key('ArrowDown');
    expect(key('Tab').defaultPrevented).toBe(false);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'tab');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('multiple: Enter commits and keeps the listbox open on the same option', () => {
    render(
      <Picker mode="editable" multiple>
        {FRUITS}
      </Picker>,
    );
    key('ArrowDown');
    key('ArrowDown');
    key('Enter');
    expect(expanded()).toBe(true);
    expect(activeText()).toBe('Banana');
    key('ArrowDown');
    key('Enter');
    expect(screen.getByTestId('value')).toHaveTextContent('b,c');
  });

  it('multiple: clicking an option keeps the listbox open', () => {
    render(
      <Picker mode="editable" multiple defaultOpen>
        {FRUITS}
      </Picker>,
    );
    fireEvent.click(screen.getByRole('option', { name: 'Cherry' }));
    fireEvent.click(screen.getByRole('option', { name: 'Apple' }));
    expect(expanded()).toBe(true);
    expect(screen.getByTestId('value')).toHaveTextContent('c,a');
  });
});

/* ------------------------------------------------------------------ */
/*  Disabled options (input-pickers#28)                                */
/* ------------------------------------------------------------------ */

describe('useListbox — disabled options (input-pickers#28)', () => {
  const WITH_DISABLED = (
    <>
      <Opt value="a" disabled>
        Apple
      </Opt>
      <Opt value="b">Banana</Opt>
      <Opt value="bl" disabled>
        Blueberry
      </Opt>
      <Opt value="c">Cherry</Opt>
    </>
  );

  it('navigation skips disabled options', () => {
    render(<Picker>{WITH_DISABLED}</Picker>);
    key('ArrowDown');
    expect(activeText()).toBe('Banana');
    key('ArrowDown');
    expect(activeText()).toBe('Cherry');
    key('Home');
    expect(activeText()).toBe('Banana');
  });

  it('typeahead skips disabled options', () => {
    render(<Picker>{WITH_DISABLED}</Picker>);
    key('b');
    key('b');
    expect(activeText()).toBe('Banana');
  });

  it('clicking a disabled option does nothing', () => {
    const onSelect = vi.fn();
    render(
      <Picker defaultOpen onSelectSpy={onSelect}>
        {WITH_DISABLED}
      </Picker>,
    );
    fireEvent.click(screen.getByRole('option', { name: 'Apple' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(expanded()).toBe(true);
  });

  it('a disabled option can never become active, so Enter/Space cannot commit it', () => {
    const onSelect = vi.fn();
    const ref = React.createRef<UseListboxResult>();
    render(
      <Picker defaultOpen autoHighlight={false} onSelectSpy={onSelect} resultRef={ref}>
        {WITH_DISABLED}
      </Picker>,
    );
    act(() => ref.current?.setActiveValue('a'));
    expect(ref.current?.activeValue).toBeNull();
    key('Enter');
    key(' ');
    expect(onSelect).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  Scroll into view (input-pickers#18)                                */
/* ------------------------------------------------------------------ */

describe('useListbox — scrollIntoView (input-pickers#18)', () => {
  it('scrolls the active option into view with block: nearest', () => {
    const scroll = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      render(<Picker defaultValue="c">{FRUITS}</Picker>);
      key('ArrowDown');
      expect(scroll).toHaveBeenLastCalledWith({ block: 'nearest' });
      expect(scroll.mock.contexts.at(-1)).toBe(screen.getByRole('option', { name: 'Cherry' }));
      key('ArrowDown');
      expect(scroll.mock.contexts.at(-1)).toBe(screen.getByRole('option', { name: 'Date' }));
      const calls = scroll.mock.calls.length;
      key('ArrowDown'); // stays on Date (loop=false): no new scroll
      expect(scroll.mock.calls.length).toBe(calls);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('a pointer highlight does not scroll the list under the pointer; keyboard moves still do', () => {
    const scroll = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      render(<Picker defaultOpen>{FRUITS}</Picker>);
      expect(activeText()).toBe('Apple');
      scroll.mockClear();
      fireEvent.pointerMove(screen.getByRole('option', { name: 'Cherry' }));
      expect(activeText()).toBe('Cherry');
      fireEvent.pointerMove(screen.getByRole('option', { name: 'Date' }));
      expect(activeText()).toBe('Date');
      expect(scroll).not.toHaveBeenCalled();
      key('ArrowUp');
      expect(scroll.mock.contexts.at(-1)).toBe(screen.getByRole('option', { name: 'Cherry' }));
      // Back to the option the pointer highlighted before: a keyboard move, so it scrolls.
      key('ArrowDown');
      expect(scroll).toHaveBeenCalledTimes(2);
      expect(scroll.mock.contexts.at(-1)).toBe(screen.getByRole('option', { name: 'Date' }));
      // A pointer highlight after keyboard moves still does not scroll.
      fireEvent.pointerMove(screen.getByRole('option', { name: 'Banana' }));
      expect(activeText()).toBe('Banana');
      expect(scroll).toHaveBeenCalledTimes(2);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('a pointer-highlighted option that becomes the fallback later is scrolled into view', () => {
    const scroll = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      const { rerender } = render(<DataPicker mode="select-only" items={ITEMS} defaultOpen />);
      fireEvent.pointerMove(screen.getByRole('option', { name: 'Banana' }));
      expect(activeText()).toBe('Banana');
      scroll.mockClear();
      // Banana is removed: the fallback (Apple) is not a pointer highlight, so it scrolls.
      rerender(<DataPicker mode="select-only" items={[ITEMS[0], ITEMS[2]]} defaultOpen />);
      expect(activeText()).toBe('Apple');
      expect(scroll.mock.contexts.at(-1)).toBe(screen.getByRole('option', { name: 'Apple' }));
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});

/* ------------------------------------------------------------------ */
/*  StrictMode, context guard, SSR                                     */
/* ------------------------------------------------------------------ */

describe('useListbox — StrictMode', () => {
  it('fires onSelect and onOpenChange once per interaction', () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <Picker onSelectSpy={onSelect} onOpenChangeSpy={onOpenChange}>
          {FRUITS}
        </Picker>
      </React.StrictMode>,
    );
    key('ArrowDown');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    key('ArrowDown');
    expect(activeText()).toBe('Banana');
    key('Enter');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('items')).toHaveTextContent('a,b,c,d');
  });

  // A reorder test cannot show this under StrictMode: React re-runs the effects of moved fibers in
  // development there, so the moved option registers again and the order is re-sorted anyway.
  it('the option observer is connected again after the effect double-invoke', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    try {
      render(
        <React.StrictMode>
          <Picker>{FRUITS}</Picker>
        </React.StrictMode>,
      );
      await act(async () => {});
      expect(observe.mock.lastCall?.[0]).toBe(screen.getByRole('listbox', { hidden: true }));
      const lastObserve = Math.max(...observe.mock.invocationCallOrder);
      expect(disconnect.mock.invocationCallOrder.every((order) => order < lastObserve)).toBe(true);
    } finally {
      observe.mockRestore();
      disconnect.mockRestore();
    }
  });
});

describe('useListboxOption — context guard (C-CONTEXT)', () => {
  it('throws a [WaveUI] error in development outside a listbox', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Opt value="a">Apple</Opt>)).toThrow(
      '[WaveUI] Option must be used within a listbox',
    );
    error.mockRestore();
  });
});

describe('useListbox — SSR and first render (input-pickers#6)', () => {
  const COUNTRIES = (
    <>
      <Opt value="no">Norway</Opt>
      <Group label="Americas">
        <Opt value="us">United States</Opt>
      </Group>
    </>
  );

  it('renderToString shows the label of the default value (collectOptionLabels)', () => {
    const html = renderToString(<Picker defaultValue="us">{COUNTRIES}</Picker>);
    expect(html).toContain('United States');
    expect(html).toMatch(/role="option"[^>]*aria-selected="true"/);
  });

  it('the editable variant shows the label as the input value on the server', () => {
    const html = renderToString(
      <Picker mode="editable" defaultValue="us">
        {COUNTRIES}
      </Picker>,
    );
    expect(html).toMatch(/value="United States"/);
  });

  it('hydrates without mismatches, then uses the registered options', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Picker defaultValue="us">{COUNTRIES}</Picker>);
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <Picker defaultValue="us">{COUNTRIES}</Picker>);
      });
      expect(error).not.toHaveBeenCalled();
      expect(screen.getByTestId('items')).toHaveTextContent('no,us');
      expect(combobox()).toHaveTextContent('United States');
      key('ArrowDown');
      expect(activeText()).toBe('United States');
    } finally {
      act(() => root?.unmount());
      container.remove();
      error.mockRestore();
    }
  });
});
