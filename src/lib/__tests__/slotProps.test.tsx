import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { mergeSlotProps, type SlotPart, type SlotPartOwn } from '../slotProps';
import slotPropsSource from '../slotProps.ts?raw';

afterEach(() => {
  vi.restoreAllMocks();
});

type Props = Record<string, unknown>;

interface FakeEvent {
  defaultPrevented: boolean;
  preventDefault(): void;
}

/** An event as `composeEventHandlers` reads it: `preventDefault()` sets `defaultPrevented`. */
function fakeEvent(): FakeEvent {
  const event: FakeEvent = {
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
  };
  return event;
}

/** Calls the handler under `key` of merged props with `event`. */
function fire(props: Props, key: string, event: FakeEvent = fakeEvent()): FakeEvent {
  const handler = props[key];
  if (typeof handler !== 'function') throw new Error(`${key} is not a function`);
  (handler as (event: FakeEvent) => void)(event);
  return event;
}

/** A part that only `as unknown` can build: keys the type rejects, to test the run-time drop. */
const asPart = (props: Props): SlotPart<'span'> => props as unknown as SlotPart<'span'>;

describe('mergeSlotProps without a part', () => {
  it('returns the defaults, className, style, ref and locked attributes, and nothing else', () => {
    const ref = React.createRef<HTMLSpanElement>();
    const style = { inlineSize: 40 };
    const own: SlotPartOwn = {
      className: 'wave-switch__track base',
      style,
      ref,
      defaults: { title: 'Track', 'aria-hidden': true },
      locked: { id: 'track-1', role: 'presentation' },
    };
    const merged = mergeSlotProps(undefined, own);
    expect(merged).toStrictEqual({
      title: 'Track',
      'aria-hidden': true,
      className: 'wave-switch__track base',
      style,
      ref,
      id: 'track-1',
      role: 'presentation',
    });
    expect(merged.style).toBe(style);
    expect(merged.ref).toBe(ref);
  });

  it('omits className, style and ref when the component gives none', () => {
    expect(mergeSlotProps(undefined, {})).toStrictEqual({});
    expect(Object.keys(mergeSlotProps(undefined, { defaults: { title: 'T' } }))).toEqual(['title']);
  });

  it('passes the component className through untouched (no class merging runs)', () => {
    // A string the class merger would normalise: kept as given, so the markup cannot change.
    const className = '  wave-switch__track   base ';
    expect(mergeSlotProps(undefined, { className }).className).toBe(className);
    expect(mergeSlotProps({}, { className }).className).toBe(className);
  });
});

describe('mergeSlotProps with an empty part', () => {
  const ref = React.createRef<HTMLSpanElement>();
  const owns: Array<[string, SlotPartOwn]> = [
    ['nothing', {}],
    ['a className', { className: 'wave-switch__thumb a  b' }],
    ['a style', { style: { insetInlineStart: '50%' } }],
    ['a ref', { ref }],
    [
      'everything',
      {
        className: 'wave-switch__thumb',
        style: { insetInlineStart: '50%' },
        ref,
        defaults: { title: 'Thumb', onPointerDown: () => {} },
        locked: { 'aria-hidden': true, onClick: () => {}, 'aria-controls': undefined },
      },
    ],
  ];

  it.each(owns)('gives the same props as no part (%s)', (_label, own) => {
    const none = mergeSlotProps(undefined, own);
    for (const empty of [
      {},
      asPart({ id: undefined, className: undefined, style: undefined, ref: undefined }),
      asPart({ onClick: undefined, title: null, className: '' }),
    ]) {
      const merged = mergeSlotProps(empty, own);
      expect(merged).toStrictEqual(none);
      expect(Object.keys(merged)).toEqual(Object.keys(none));
      expect(merged.style).toBe(none.style);
      expect(merged.ref).toBe(none.ref);
    }
  });

  it.each(owns)('renders the same markup as no part (%s)', (_label, own) => {
    const markup = (part: SlotPart<'span'> | undefined) =>
      renderToStaticMarkup(<span {...mergeSlotProps(part, own)}>x</span>);
    expect(markup({})).toBe(markup(undefined));
  });
});

describe('mergeSlotProps className and style', () => {
  it('merges className with the component classes first and the consumer last', () => {
    const merged = mergeSlotProps(
      { className: 'px-2 mine' },
      { className: 'wave-switch__track px-4 text-body-1' },
    );
    expect(merged.className).toBe('wave-switch__track text-body-1 px-2 mine');
    expect(mergeSlotProps({ className: 'mine' }, {}).className).toBe('mine');
  });

  it('merges style with the consumer keys winning', () => {
    const merged = mergeSlotProps(
      { style: { color: 'blue', margin: 2 } },
      { style: { color: 'red', inlineSize: 10 } },
    );
    expect(merged.style).toEqual({ color: 'blue', inlineSize: 10, margin: 2 });
    expect(mergeSlotProps({ style: { margin: 2 } }, {}).style).toEqual({ margin: 2 });
  });

  it('never lets an undefined consumer style key erase the component value', () => {
    const merged = mergeSlotProps(
      { style: { inlineSize: undefined, color: 'blue' } },
      { style: { inlineSize: 10 } },
    );
    expect(merged.style).toEqual({ inlineSize: 10, color: 'blue' });
  });

  it('omits style when neither side has a value', () => {
    expect('style' in mergeSlotProps({ style: {} }, {})).toBe(false);
    expect('style' in mergeSlotProps({ style: { color: undefined } }, {})).toBe(false);
    expect('style' in mergeSlotProps({}, {})).toBe(false);
  });

  it('does not mutate its inputs', () => {
    const ownStyle = Object.freeze({ color: 'red' });
    const part = Object.freeze({
      className: 'mine',
      style: Object.freeze({ margin: 2 }),
      title: 'Mine',
      onClick: () => {},
    });
    const defaults = Object.freeze({ title: 'Default', onClick: () => {} });
    const locked = Object.freeze({ role: 'switch', onKeyDown: () => {} });
    const own = Object.freeze({ className: 'own', style: ownStyle, defaults, locked });
    expect(() => mergeSlotProps(part, own)).not.toThrow();
    expect(ownStyle).toEqual({ color: 'red' });
    expect(part.style).toEqual({ margin: 2 });
  });
});

describe('mergeSlotProps handlers', () => {
  it('composes a handler both sides have, the consumer first', () => {
    const calls: string[] = [];
    const merged = mergeSlotProps(
      { onClick: () => calls.push('consumer') },
      { defaults: { onClick: () => calls.push('ours') } },
    );
    fire(merged, 'onClick');
    expect(calls).toEqual(['consumer', 'ours']);
  });

  it('skips ours when the consumer calls preventDefault()', () => {
    const ours = vi.fn();
    const merged = mergeSlotProps(
      { onKeyDown: (event) => event.preventDefault() },
      { defaults: { onKeyDown: ours } },
    );
    expect(fire(merged, 'onKeyDown').defaultPrevented).toBe(true);
    expect(ours).not.toHaveBeenCalled();
  });

  it('composes a locked handler too: the consumer runs first and cannot remove it', () => {
    const calls: string[] = [];
    const locked = () => calls.push('locked');
    const merged = mergeSlotProps(
      { onClick: () => calls.push('consumer') },
      { locked: { onClick: locked } },
    );
    fire(merged, 'onClick');
    expect(calls).toEqual(['consumer', 'locked']);
    // A consumer value that is no function never replaces it.
    expect(mergeSlotProps(asPart({ onClick: null }), { locked: { onClick: locked } }).onClick).toBe(
      locked,
    );
    expect(mergeSlotProps(asPart({ onClick: 'x' }), { locked: { onClick: locked } }).onClick).toBe(
      locked,
    );
  });

  it('lets the consumer cancel a locked handler only through preventDefault()', () => {
    const locked = vi.fn();
    const merged = mergeSlotProps(
      { onClick: (event) => event.preventDefault() },
      { locked: { onClick: locked } },
    );
    fire(merged, 'onClick');
    expect(locked).not.toHaveBeenCalled();
  });

  it('passes a handler only one side has through unchanged', () => {
    const consumer = vi.fn();
    const ours = vi.fn();
    const lockedOnly = vi.fn();
    const merged = mergeSlotProps(
      { onFocus: consumer },
      { defaults: { onBlur: ours }, locked: { onMouseDown: lockedOnly } },
    );
    expect(merged.onFocus).toBe(consumer);
    expect(merged.onBlur).toBe(ours);
    expect(merged.onMouseDown).toBe(lockedOnly);
  });

  it('never lets a nullish consumer handler remove ours', () => {
    const ours = vi.fn();
    for (const value of [null, undefined]) {
      expect(
        mergeSlotProps(asPart({ onClick: value }), { defaults: { onClick: ours } }).onClick,
      ).toBe(ours);
    }
  });

  it('composes the locked handler, not the default, when a key is in both', () => {
    const calls: string[] = [];
    const own: SlotPartOwn = {
      defaults: { onClick: () => calls.push('default') },
      locked: { onClick: () => calls.push('locked') },
    };
    fire(mergeSlotProps({ onClick: () => calls.push('consumer') }, own), 'onClick');
    expect(calls).toEqual(['consumer', 'locked']);
    calls.length = 0;
    fire(mergeSlotProps(undefined, own), 'onClick');
    expect(calls).toEqual(['locked']);
  });

  it('keeps a consumer handler when the locked value of its key is undefined', () => {
    const calls: string[] = [];
    const merged = mergeSlotProps(
      { onClick: () => calls.push('consumer') },
      { defaults: { onClick: () => calls.push('default') }, locked: { onClick: undefined } },
    );
    fire(merged, 'onClick');
    expect(calls).toEqual(['consumer', 'default']);
  });

  it('replaces a function-valued attribute that is no handler (on and a capital letter)', () => {
    const ours = vi.fn();
    const theirs = vi.fn();
    expect(
      mergeSlotProps<'button'>({ formAction: theirs }, { defaults: { formAction: ours } })
        .formAction,
    ).toBe(theirs);
    expect(
      mergeSlotProps(asPart({ onboarding: theirs }), { defaults: { onboarding: ours } }).onboarding,
    ).toBe(theirs);
  });

  it('cancels the internal toggle of a rendered part through preventDefault()', () => {
    render(<Toggle slotProps={{ root: { onClick: (event) => event.preventDefault() } }} />);
    const button = screen.getByRole('button', { name: 'Bold' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('runs the consumer handler first and then the internal toggle of a rendered part', () => {
    const order: string[] = [];
    render(
      <Toggle
        onPressedChange={() => order.push('internal')}
        slotProps={{ root: { onClick: () => order.push('consumer') } }}
      />,
    );
    const button = screen.getByRole('button', { name: 'Bold' });
    fireEvent.click(button);
    expect(order).toEqual(['consumer', 'internal']);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('mergeSlotProps refs', () => {
  it('merges an object ref and a callback ref when both sides have one', () => {
    const ours = React.createRef<HTMLSpanElement>();
    const theirs = vi.fn();
    const { unmount } = render(
      <span {...mergeSlotProps({ ref: theirs }, { ref: ours })} data-testid="part" />,
    );
    const part = screen.getByTestId('part');
    expect(ours.current).toBe(part);
    expect(theirs).toHaveBeenCalledWith(part);
    unmount();
    expect(ours.current).toBeNull();
    expect(theirs).toHaveBeenLastCalledWith(null);
  });

  it('merges a callback ref and an object ref the other way round', () => {
    const ours = vi.fn();
    const theirs = React.createRef<HTMLSpanElement>();
    render(<span {...mergeSlotProps({ ref: theirs }, { ref: ours })} data-testid="part" />);
    expect(ours).toHaveBeenCalledWith(screen.getByTestId('part'));
    expect(theirs.current).toBe(screen.getByTestId('part'));
  });

  it('passes a ref only one side has through unchanged', () => {
    const ours = React.createRef<HTMLSpanElement>();
    const theirs = vi.fn();
    expect(mergeSlotProps({ ref: theirs }, {}).ref).toBe(theirs);
    expect(mergeSlotProps(undefined, { ref: ours }).ref).toBe(ours);
    expect(mergeSlotProps(asPart({ ref: null }), { ref: ours }).ref).toBe(ours);
    expect('ref' in mergeSlotProps({}, {})).toBe(false);
  });

  it('gives the same merged ref for the same pair of refs, and a new one for a new pair', () => {
    const ours = vi.fn();
    const theirs = React.createRef<HTMLSpanElement>();
    const first = mergeSlotProps({ ref: theirs }, { ref: ours }).ref;
    expect(mergeSlotProps({ ref: theirs }, { ref: ours }).ref).toBe(first);
    expect(mergeSlotProps({ ref: React.createRef<HTMLSpanElement>() }, { ref: ours }).ref).not.toBe(
      first,
    );
    expect(mergeSlotProps({ ref: theirs }, { ref: vi.fn<(node: unknown) => void>() }).ref).not.toBe(
      first,
    );
  });

  it('does not make React detach and re-attach the refs on a re-render', () => {
    const ours = vi.fn();
    const theirs = React.createRef<HTMLSpanElement>();
    function Part({ label }: { label: string }) {
      return <span {...mergeSlotProps({ ref: theirs }, { ref: ours })}>{label}</span>;
    }
    const { rerender, unmount } = render(<Part label="first" />);
    expect(ours).toHaveBeenCalledTimes(1);
    rerender(<Part label="second" />);
    expect(ours).toHaveBeenCalledTimes(1);
    expect(theirs.current).toBe(screen.getByText('second'));
    unmount();
    expect(ours).toHaveBeenCalledTimes(2);
    expect(ours).toHaveBeenLastCalledWith(null);
  });
});

describe('mergeSlotProps defaults and locked attributes', () => {
  it('lets a consumer attribute replace a default', () => {
    const merged = mergeSlotProps(
      { title: 'Mine', 'aria-hidden': false },
      { defaults: { title: 'Default', 'aria-hidden': true, type: 'button' } },
    );
    expect(merged).toStrictEqual({ title: 'Mine', 'aria-hidden': false, type: 'button' });
  });

  it('never lets an undefined or null consumer value erase a default', () => {
    const merged = mergeSlotProps(asPart({ id: undefined, title: null }), {
      defaults: { id: 'default-id', title: 'Default' },
    });
    expect(merged).toStrictEqual({ id: 'default-id', title: 'Default' });
    // Nor does it add the key when there is no default.
    expect(mergeSlotProps(asPart({ id: undefined, title: null }), {})).toStrictEqual({});
  });

  it.each<[string, unknown, unknown]>([
    ['role', 'switch', 'button'],
    ['id', 'track-1', 'mine'],
    ['tabIndex', -1, 0],
    ['disabled', true, false],
    ['hidden', true, false],
    ['aria-checked', true, false],
    ['aria-controls', 'popup-1', 'other'],
    ['aria-labelledby', 'label-1', 'other'],
    ['aria-describedby', 'message-1', 'other'],
    ['aria-invalid', true, false],
  ])('keeps the locked %s over the consumer value', (key, ours, theirs) => {
    const merged = mergeSlotProps(asPart({ [key]: theirs }), {
      defaults: { [key]: 'default' },
      locked: { [key]: ours },
    });
    expect(merged[key]).toBe(ours);
  });

  it('keeps a locked key whose value is undefined (the component state wins)', () => {
    const merged = mergeSlotProps(asPart({ 'aria-controls': 'stale' }), {
      locked: { 'aria-controls': undefined },
    });
    expect('aria-controls' in merged).toBe(true);
    expect(merged['aria-controls']).toBeUndefined();
  });

  it('keeps the locked attributes of a rendered part', () => {
    render(
      <Toggle
        slotProps={{
          root: {
            'aria-pressed': true,
            tabIndex: -1,
            disabled: true,
            id: 'mine',
            title: 'Mine',
          },
        }}
      />,
    );
    const button = screen.getByRole('button', { name: 'Bold' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('tabindex', '0');
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('id', 'toggle-1');
    // `title` is a default: the consumer value replaces it.
    expect(button).toHaveAttribute('title', 'Mine');
  });

  it('passes data-* and aria-* attributes', () => {
    render(
      <Toggle
        slotProps={{
          root: { 'data-part': 'root', 'data-count': 3, 'aria-describedby': 'hint' },
          thumb: { 'data-flag': true, className: 'mine' },
        }}
      />,
    );
    const button = screen.getByRole('button', { name: 'Bold' });
    expect(button).toHaveAttribute('data-part', 'root');
    expect(button).toHaveAttribute('data-count', '3');
    expect(button).toHaveAttribute('aria-describedby', 'hint');
    const thumb = button.querySelector('[data-flag]');
    expect(thumb).toHaveAttribute('data-flag', 'true');
    expect(thumb).toHaveClass('wave-toggle__thumb', 'mine');
    expect(thumb).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('mergeSlotProps keys a part never forwards', () => {
  it('drops children, as, key and dangerouslySetInnerHTML at run time', () => {
    const merged = mergeSlotProps(
      asPart({
        children: 'Replaced',
        as: 'div',
        key: 'k',
        dangerouslySetInnerHTML: { __html: '<b>Injected</b>' },
        title: 'Mine',
      }),
      { className: 'wave-switch__thumb' },
    );
    expect(merged).toStrictEqual({ title: 'Mine', className: 'wave-switch__thumb' });
  });

  it('keeps the content and element of a rendered part', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Toggle
        slotProps={{
          thumb: asPart({
            children: 'Replaced',
            as: 'div',
            key: 'k',
            dangerouslySetInnerHTML: { __html: '<b>Injected</b>' },
          }),
        }}
      />,
    );
    const thumb = screen.getByRole('button', { name: 'Bold' }).firstElementChild;
    expect(thumb?.tagName).toBe('SPAN');
    expect(thumb).toBeEmptyDOMElement();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('mergeSlotProps on real elements', () => {
  it('spreads on a span, an input and a button with no React warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spanRef = React.createRef<HTMLSpanElement>();
    const inputRef = React.createRef<HTMLInputElement>();
    const onChange = vi.fn();
    const onClick = vi.fn();
    render(
      <>
        <span
          {...mergeSlotProps(
            {
              className: 'mine',
              style: { color: 'blue' },
              ref: spanRef,
              'data-part': 'track',
              'aria-label': 'Track',
              onPointerDown: () => {},
            },
            {
              className: 'wave-switch__track',
              style: { inlineSize: 40 },
              ref: vi.fn<(node: unknown) => void>(),
              defaults: { title: 'Track' },
              locked: { role: 'presentation', 'aria-hidden': true, onClick: () => {} },
            },
          )}
        />
        <input
          {...mergeSlotProps<'input'>(
            { placeholder: 'Name', onChange, ref: inputRef, 'data-part': 'input', required: true },
            {
              className: 'wave-input__input',
              defaults: { type: 'text', autoComplete: 'off' },
              locked: { id: 'name', 'aria-invalid': false, onChange: () => {} },
            },
          )}
        />
        <button
          type="button"
          {...mergeSlotProps<'button'>(
            { onClick, formAction: undefined, 'aria-describedby': 'hint', tabIndex: 3 },
            { className: 'wave-button', locked: { tabIndex: 0, disabled: false } },
          )}
        >
          Go
        </button>
      </>,
    );
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(spanRef.current).toHaveClass('wave-switch__track', 'mine');
    expect(inputRef.current).toHaveAttribute('id', 'name');
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('mergeSlotProps invariants (seeded random combinations)', () => {
  const ATTRIBUTE_KEYS = ['id', 'role', 'title', 'tabIndex', 'aria-label', 'data-state'];
  const HANDLER_KEYS = ['onClick', 'onKeyDown', 'onFocus'];
  const RUNS = 400;

  /** mulberry32: a small seeded generator, so a failing case is reproducible from its run. */
  function seeded(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('locked attributes win, the consumer class is last, its handler runs first and never removes a locked one', () => {
    const failures: string[] = [];
    for (let run = 1; run <= RUNS; run++) {
      const random = seeded(run);
      const calls: string[] = [];
      const handler = (name: string, prevent: boolean) => (event: FakeEvent) => {
        calls.push(name);
        if (prevent) event.preventDefault();
      };
      const defaults: Props = {};
      const locked: Props = {};
      const part: Props = {};
      for (const key of ATTRIBUTE_KEYS) {
        if (random() < 0.5) defaults[key] = `default-${key}`;
        const l = random();
        if (l < 0.3) locked[key] = `locked-${key}`;
        else if (l < 0.4) locked[key] = undefined;
        const c = random();
        if (c < 0.4) part[key] = `consumer-${key}`;
        else if (c < 0.5) part[key] = undefined;
        else if (c < 0.6) part[key] = null;
      }
      for (const key of HANDLER_KEYS) {
        if (random() < 0.5) defaults[key] = handler(`default:${key}`, false);
        const l = random();
        if (l < 0.4) locked[key] = handler(`locked:${key}`, false);
        else if (l < 0.5) locked[key] = undefined;
        const c = random();
        if (c < 0.5) part[key] = handler(`consumer:${key}`, random() < 0.3);
        else if (c < 0.6) part[key] = undefined;
        else if (c < 0.7) part[key] = null;
      }
      const ownClass = [undefined, 'own-a', 'own-a own-b'][Math.floor(random() * 3)];
      const theirClass = [undefined, '', 'their-c'][Math.floor(random() * 3)];
      if (theirClass !== undefined) part.className = theirClass;
      const own: SlotPartOwn = { className: ownClass, defaults, locked };
      const merged = mergeSlotProps(asPart(part), own);
      const fail = (message: string) => failures.push(`run ${run}: ${message}`);

      for (const key of ATTRIBUTE_KEYS) {
        const expected =
          key in locked
            ? locked[key]
            : part[key] != null
              ? part[key]
              : key in defaults
                ? defaults[key]
                : undefined;
        if (merged[key] !== expected)
          fail(`${key} is ${String(merged[key])}, not ${String(expected)}`);
      }

      for (const key of HANDLER_KEYS) {
        const consumer = part[key];
        const lockedHandler = typeof locked[key] === 'function' ? locked[key] : undefined;
        const ours =
          lockedHandler ?? (typeof defaults[key] === 'function' ? defaults[key] : undefined);
        if (typeof consumer !== 'function') {
          const expected = key in locked ? locked[key] : defaults[key];
          if (merged[key] !== expected) fail(`${key} is not ours unchanged`);
          continue;
        }
        calls.length = 0;
        const event = fire(merged, key);
        if (calls[0] !== `consumer:${key}`)
          fail(`${key} ran ${calls.join(', ')}, not the consumer first`);
        const expectedCalls = [`consumer:${key}`];
        if (ours && !event.defaultPrevented) {
          expectedCalls.push(lockedHandler ? `locked:${key}` : `default:${key}`);
        }
        if (calls.join() !== expectedCalls.join()) {
          fail(`${key} ran ${calls.join(', ')}, not ${expectedCalls.join(', ')}`);
        }
      }

      const expectedClass = theirClass
        ? [ownClass, theirClass].filter(Boolean).join(' ')
        : ownClass;
      if (merged.className !== expectedClass) {
        fail(`className is ${String(merged.className)}, not ${String(expectedClass)}`);
      }
      if (expectedClass === undefined && 'className' in merged) fail('className without a class');

      const allowed = new Set([
        'className',
        ...Object.keys(defaults),
        ...Object.keys(locked),
        ...Object.keys(part).filter((key) => part[key] != null),
      ]);
      for (const key of Object.keys(merged)) {
        if (!allowed.has(key)) fail(`unexpected key ${key}`);
      }

      const none = mergeSlotProps(undefined, own);
      const empty = mergeSlotProps({}, own);
      if (Object.keys(none).join() !== Object.keys(empty).join()) {
        fail('an empty part gives other keys than no part');
      }
      for (const key of Object.keys(none)) {
        if (none[key] !== empty[key]) fail(`an empty part changes ${key}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('mergeSlotProps on the server', () => {
  it('renders to a string with the same markup for no part and an empty part', () => {
    const none = renderToStaticMarkup(<Toggle />);
    expect(renderToStaticMarkup(<Toggle slotProps={{ root: {}, thumb: {} }} />)).toBe(none);
    expect(none).toBe(
      '<button type="button" title="Toggle" class="wave-toggle" aria-pressed="false" id="toggle-1" tabindex="0">' +
        '<span class="wave-toggle__thumb" aria-hidden="true"></span>Bold</button>',
    );
  });

  it('imports cn, composeEventHandlers and mergeRefs at run time, and types only otherwise', () => {
    const statements = importStatements(slotPropsSource);
    expect(statements.filter(({ typeOnly }) => !typeOnly).map(({ text }) => text)).toEqual([
      "import { cn } from './cn'",
      "import { composeEventHandlers } from './composeEventHandlers'",
      "import { mergeRefs } from './mergeRefs'",
    ]);
    expect(statements.filter(({ typeOnly }) => typeOnly).map(({ specifier }) => specifier)).toEqual(
      ['react'],
    );
    expect(slotPropsSource).not.toMatch(/\brequire\s*\(|\bimport\s*\(|['"]use client['"]/);
  });
});

describe('SlotPart and mergeSlotProps types', () => {
  it('takes the props of the part element', () => {
    expectTypeOf<SlotPart<'input'>>().toHaveProperty('placeholder');
    expectTypeOf<SlotPart<'span'>>().not.toHaveProperty('placeholder');
    expectTypeOf<SlotPart<'input'>['ref']>().toEqualTypeOf<
      React.Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<SlotPart<'button'>['onClick']>().toEqualTypeOf<
      React.MouseEventHandler<HTMLButtonElement> | undefined
    >();
    expectTypeOf<SlotPart<'span'>['className']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<SlotPart<'span'>['style']>().toEqualTypeOf<React.CSSProperties | undefined>();

    const input: SlotPart<'input'> = {
      placeholder: 'Name',
      'data-part': 'input',
      'data-count': 2,
      'data-on': true,
    };
    // @ts-expect-error a span has no placeholder
    const span: SlotPart<'span'> = { placeholder: 'Name' };
    // @ts-expect-error a data attribute is a string, a number or a boolean
    const data: SlotPart<'span'> = { 'data-part': { nested: true } };
    expect([input, span, data]).toHaveLength(3);
  });

  it('rejects children, as, key and dangerouslySetInnerHTML', () => {
    expectTypeOf<SlotPart<'span'>>().not.toHaveProperty('children');
    expectTypeOf<SlotPart<'span'>>().not.toHaveProperty('as');
    expectTypeOf<SlotPart<'span'>>().not.toHaveProperty('key');
    expectTypeOf<SlotPart<'span'>>().not.toHaveProperty('dangerouslySetInnerHTML');

    // @ts-expect-error a part never takes children: the component owns its content
    const withChildren: SlotPart<'span'> = { children: 'Replaced' };
    // @ts-expect-error a part is never rendered as another element
    const withAs: SlotPart<'span'> = { as: 'div' };
    // @ts-expect-error a part takes no key
    const withKey: SlotPart<'span'> = { key: 'k' };
    // @ts-expect-error a part takes no markup of its own
    const withHtml: SlotPart<'span'> = { dangerouslySetInnerHTML: { __html: '' } };
    expect([withChildren, withAs, withKey, withHtml]).toHaveLength(4);
  });

  it('infers the element from a typed part, and falls back to a span', () => {
    type Signature = <E extends keyof React.JSX.IntrinsicElements = 'span'>(
      part: SlotPart<E> | undefined,
      own: SlotPartOwn,
    ) => Record<string, unknown>;
    expectTypeOf(mergeSlotProps).toEqualTypeOf<Signature>();
    // The same signature, returning the element it infers. A part of another element would be
    // assignable to a span part anyway, so only inference shows which element a call takes.
    const inferred = <E extends keyof React.JSX.IntrinsicElements = 'span'>(
      part: SlotPart<E> | undefined,
      own: SlotPartOwn,
    ): E => [part, own] as unknown as E;
    const slotProps: { input?: SlotPart<'input'>; button?: SlotPart<'button'> } = {};
    expectTypeOf(inferred(slotProps.input, {})).toEqualTypeOf<'input'>();
    expectTypeOf(inferred(slotProps.button, {})).toEqualTypeOf<'button'>();
    expectTypeOf(inferred(undefined, {})).toEqualTypeOf<'span'>();
    expectTypeOf(inferred({ title: 'Inline' }, {})).toEqualTypeOf<'span'>();
    expectTypeOf<SlotPart<'input'>>().toExtend<SlotPart<'span'>>();
  });

  it('returns the props to spread', () => {
    expectTypeOf(mergeSlotProps<'input'>)
      .parameter(0)
      .toEqualTypeOf<SlotPart<'input'> | undefined>();
    expectTypeOf(mergeSlotProps<'input'>)
      .parameter(1)
      .toEqualTypeOf<SlotPartOwn>();
    expectTypeOf(mergeSlotProps<'input'>).returns.toEqualTypeOf<Record<string, unknown>>();
    expectTypeOf<SlotPartOwn['ref']>().toEqualTypeOf<React.Ref<unknown> | undefined>();
    // Any element's ref fits the component's own ref.
    expectTypeOf<React.Ref<HTMLInputElement>>().toExtend<SlotPartOwn['ref']>();
    expectTypeOf<React.Dispatch<React.SetStateAction<HTMLElement | null>>>().toExtend<
      SlotPartOwn['ref']
    >();

    const slotProps: { track?: SlotPart<'span'>; input?: SlotPart<'input'> } = {};
    // @ts-expect-error a span part takes no placeholder, whatever the call infers
    mergeSlotProps({ placeholder: 'Name' }, {});
    expect(mergeSlotProps(slotProps.track, {})).toStrictEqual({});
    expect(mergeSlotProps(slotProps.input, {})).toStrictEqual({});
  });
});

interface ToggleProps {
  onPressedChange?: (pressed: boolean) => void;
  slotProps?: { root?: SlotPart<'button'>; thumb?: SlotPart<'span'> };
}

/** A component with two parts, as a rollout writes them. */
function Toggle({ onPressedChange, slotProps }: ToggleProps) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <button
      type="button"
      {...mergeSlotProps(slotProps?.root, {
        className: 'wave-toggle',
        defaults: { title: 'Toggle' },
        locked: {
          'aria-pressed': pressed,
          id: 'toggle-1',
          tabIndex: 0,
          disabled: undefined,
          onClick: () => {
            setPressed(!pressed);
            onPressedChange?.(!pressed);
          },
        },
      })}
    >
      <span
        {...mergeSlotProps(slotProps?.thumb, {
          className: 'wave-toggle__thumb',
          locked: { 'aria-hidden': true },
        })}
      />
      Bold
    </button>
  );
}

/**
 * The import and re-export statements of a module's source (comments removed): each with its
 * specifier, whether it is type-only and its text on one line.
 */
function importStatements(
  source: string,
): { specifier: string; typeOnly: boolean; text: string }[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const statement =
    /^[ \t]*(?:(?:import|export)\s+(type\s+)?[\w*{}\s,$]+?\s+from\s+|import\s+)['"]([^'"]+)['"]/gm;
  return [...code.matchAll(statement)].map(([text, type, specifier]) => ({
    specifier,
    typeOnly: type !== undefined,
    text: text.trim().replace(/\s+/g, ' '),
  }));
}
