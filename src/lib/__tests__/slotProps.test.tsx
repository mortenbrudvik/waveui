import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { joinIds } from '../aria';
import {
  BUTTON_PART_LOCKS,
  composeAfterPart,
  HIDDEN_PART_LOCKS,
  lockPositionStyle,
  mergeSlotProps,
  type SlotPart,
  type SlotPartOwn,
  type SlotPartWithRef,
} from '../slotProps';
import type { NativeElementProps } from '../nativeProps';
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

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['false', false],
    ['0', 0],
    ["''", ''],
    ["'x'", 'x'],
    ['{}', {}],
  ])(
    'never lets a consumer handler value that is no function (%s) remove ours',
    (_label, value) => {
      const ours = vi.fn();
      const part = asPart({ onClick: value, onKeyDown: value });
      expect(mergeSlotProps(part, { defaults: { onClick: ours } }).onClick).toBe(ours);
      expect(mergeSlotProps(part, { locked: { onClick: ours } }).onClick).toBe(ours);
      // Nor is it forwarded where the component has no handler (`onClick: cond && fn`).
      expect('onKeyDown' in mergeSlotProps(part, { defaults: { onClick: ours } })).toBe(false);
    },
  );

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
    // Without a consumer handler the locked undefined hides the default (the documented edge of
    // a handler in both defaults and locked).
    const own: SlotPartOwn = { defaults: { onClick: () => {} }, locked: { onClick: undefined } };
    expect(mergeSlotProps(undefined, own).onClick).toBeUndefined();
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

  it.each<[string, unknown]>([
    ['false', false],
    ['0', 0],
    ["''", ''],
    ['NaN', NaN],
    ["'x'", 'x'],
    ['5', 5],
  ])(
    'skips a consumer ref that is no function or object (%s), without throwing',
    (_label, value) => {
      const ours = vi.fn<(node: unknown) => void>();
      const theirs = React.createRef<HTMLSpanElement>();
      const bad = asPart({ ref: value });
      expect(mergeSlotProps(bad, { ref: ours }).ref).toBe(ours);
      expect('ref' in mergeSlotProps(bad, {})).toBe(false);
      expect(mergeSlotProps([bad, bad], { ref: ours }).ref).toBe(ours);
      expect(mergeSlotProps([{ ref: theirs }, bad], {}).ref).toBe(theirs);
      expect(mergeSlotProps([bad, { ref: theirs }], { ref: ours }).ref).toBe(
        mergeSlotProps({ ref: theirs }, { ref: ours }).ref,
      );
      // The component's own value is held to the same rule (`ref: cond && localRef`).
      expect(mergeSlotProps({ ref: theirs }, { ref: value as SlotPartOwn['ref'] }).ref).toBe(
        theirs,
      );
    },
  );

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

describe('mergeSlotProps id lists', () => {
  it.each(['aria-describedby', 'aria-labelledby'])(
    'joins a locked %s with the consumer ids, the component ids first and once',
    (key) => {
      const merged = mergeSlotProps(asPart({ [key]: 'hint message' }), {
        locked: { [key]: 'message label' },
      });
      expect(merged[key]).toBe('message label hint');
    },
  );

  it('joins a default list with the consumer ids', () => {
    const merged = mergeSlotProps(
      { 'aria-describedby': 'hint' },
      { defaults: { 'aria-describedby': 'message' } },
    );
    expect(merged['aria-describedby']).toBe('message hint');
  });

  it('takes the locked list over the default one before joining', () => {
    const merged = mergeSlotProps(
      { 'aria-labelledby': 'mine' },
      { defaults: { 'aria-labelledby': 'default' }, locked: { 'aria-labelledby': 'label' } },
    );
    expect(merged['aria-labelledby']).toBe('label mine');
  });

  it('passes the consumer list alone, and leaves the component list alone without one', () => {
    expect(mergeSlotProps({ 'aria-describedby': 'hint' }, {})['aria-describedby']).toBe('hint');
    expect(
      mergeSlotProps({}, { locked: { 'aria-describedby': 'message' } })['aria-describedby'],
    ).toBe('message');
    expect(
      mergeSlotProps(asPart({ 'aria-describedby': undefined }), {
        locked: { 'aria-describedby': 'message' },
      })['aria-describedby'],
    ).toBe('message');
  });

  it('adds the consumer ids to a locked list that is undefined (ids are only added)', () => {
    const merged = mergeSlotProps(
      { 'aria-describedby': 'hint' },
      { locked: { 'aria-describedby': undefined } },
    );
    expect(merged['aria-describedby']).toBe('hint');
  });

  it.each<[string, unknown]>([
    ['5', 5],
    ['true', true],
    ["['hint']", ['hint']],
    ['{}', {}],
  ])('skips a consumer list that is no string (%s), without throwing', (_label, value) => {
    const bad = asPart({ 'aria-describedby': value, 'aria-labelledby': value });
    const merged = mergeSlotProps([bad, { 'aria-labelledby': 'mine' }], {
      locked: { 'aria-describedby': 'message' },
      defaults: { 'aria-labelledby': 'label' },
    });
    expect(merged['aria-describedby']).toBe('message');
    expect(merged['aria-labelledby']).toBe('label mine');
    expect('aria-describedby' in mergeSlotProps(bad, {})).toBe(false);
  });

  it('puts a joined list the component does not give after the locked attributes', () => {
    const merged = mergeSlotProps(
      { 'aria-describedby': 'hint', title: 'Mine' },
      { defaults: { id: 'part-1' }, locked: { role: 'switch' } },
    );
    expect(Object.keys(merged)).toEqual(['id', 'title', 'role', 'aria-describedby']);
    expect(renderToStaticMarkup(<span {...merged} />)).toBe(
      '<span id="part-1" title="Mine" role="switch" aria-describedby="hint"></span>',
    );
  });

  it('keeps the component ids on a rendered part', () => {
    render(
      <span
        data-testid="part"
        {...mergeSlotProps(
          { 'aria-describedby': 'extra' },
          { locked: { 'aria-describedby': 'message' } },
        )}
      />,
    );
    expect(screen.getByTestId('part')).toHaveAttribute('aria-describedby', 'message extra');
  });
});

describe('mergeSlotProps blocked handlers', () => {
  it('neither calls nor forwards the consumer handlers of the blocked keys', () => {
    const consumer = vi.fn();
    const ours = vi.fn();
    const keyDown = vi.fn();
    const merged = mergeSlotProps(
      { onClick: consumer, onKeyDown: keyDown, title: 'Mine' },
      { locked: { onClick: ours }, blockHandlers: ['onClick'] },
    );
    expect(merged.onClick).toBe(ours);
    expect(merged.onKeyDown).toBe(keyDown);
    expect(merged.title).toBe('Mine');
    fire(merged, 'onClick');
    expect(consumer).not.toHaveBeenCalled();
    expect('onClick' in mergeSlotProps({ onClick: consumer }, { blockHandlers: ['onClick'] })).toBe(
      false,
    );
  });

  it('blocks every consumer handler with true, and still merges the attributes', () => {
    const ours = vi.fn();
    const merged = mergeSlotProps(
      {
        onClick: vi.fn(),
        onKeyDown: vi.fn(),
        onFocus: vi.fn(),
        className: 'mine',
        'data-part': 'root',
        title: 'Mine',
      },
      { className: 'own', defaults: { onKeyDown: ours }, blockHandlers: true },
    );
    expect(merged).toStrictEqual({
      onKeyDown: ours,
      'data-part': 'root',
      title: 'Mine',
      className: 'own mine',
    });
  });

  it('changes nothing without blockHandlers or with an empty list', () => {
    for (const blockHandlers of [undefined, []]) {
      const calls: string[] = [];
      const merged = mergeSlotProps(
        { onClick: () => calls.push('consumer') },
        { defaults: { onClick: () => calls.push('ours') }, blockHandlers },
      );
      fire(merged, 'onClick');
      expect(calls).toEqual(['consumer', 'ours']);
    }
  });

  it('keeps a consumer click from reaching a disabledFocusable rendered part', () => {
    const consumer = vi.fn();
    const keyDown = vi.fn();
    render(
      <Toggle disabledFocusable slotProps={{ root: { onClick: consumer, onKeyDown: keyDown } }} />,
    );
    const button = screen.getByRole('button', { name: 'Bold' });
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'a' });
    expect(consumer).not.toHaveBeenCalled();
    expect(keyDown).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('mergeSlotProps with several parts', () => {
  it('applies the parts left to right, then the locked attributes (Input root and input on one element)', () => {
    const calls: string[] = [];
    const ownRef = vi.fn<(node: unknown) => void>();
    const rootRef = React.createRef<HTMLInputElement>();
    const inputRef = React.createRef<HTMLInputElement>();
    const root: SlotPart<'input'> = {
      className: 'root-class',
      style: { color: 'red', margin: 1 },
      title: 'Root',
      placeholder: 'Root',
      id: 'mine',
      'aria-describedby': 'root-hint',
      ref: rootRef,
      onClick: () => calls.push('root'),
    };
    const input: SlotPart<'input'> = {
      className: 'input-class',
      style: { color: 'blue' },
      title: 'Input',
      'aria-describedby': 'input-hint',
      ref: inputRef,
      onClick: () => calls.push('input'),
    };
    const merged = mergeSlotProps([root, input], {
      className: 'wave-input',
      ref: ownRef,
      defaults: { placeholder: 'Default', title: 'Default' },
      locked: { id: 'field-1', 'aria-describedby': 'message', onClick: () => calls.push('ours') },
    });
    expect(merged.className).toBe('wave-input root-class input-class');
    expect(merged.style).toEqual({ color: 'blue', margin: 1 });
    expect(merged.title).toBe('Input');
    expect(merged.placeholder).toBe('Root');
    expect(merged.id).toBe('field-1');
    expect(merged['aria-describedby']).toBe('message root-hint input-hint');
    fire(merged, 'onClick');
    expect(calls).toEqual(['root', 'input', 'ours']);

    render(<input {...merged} />);
    const element = screen.getByRole('textbox');
    expect(ownRef).toHaveBeenCalledWith(element);
    expect(rootRef.current).toBe(element);
    expect(inputRef.current).toBe(element);
  });

  it('runs every consumer handler, and the component one only when none prevented the default', () => {
    const calls: string[] = [];
    const merged = mergeSlotProps(
      [
        {
          onKeyDown: (event) => {
            calls.push('root');
            event.preventDefault();
          },
        },
        { onKeyDown: () => calls.push('input') },
      ],
      { locked: { onKeyDown: () => calls.push('ours') } },
    );
    fire(merged, 'onKeyDown');
    expect(calls).toEqual(['root', 'input']);
  });

  it('skips undefined entries; an empty array is no part; one part equals an array of one', () => {
    const ref = vi.fn<(node: unknown) => void>();
    const own: SlotPartOwn = {
      className: 'wave-input',
      style: { margin: 1 },
      ref,
      defaults: { title: 'Default' },
      locked: { id: 'field-1' },
    };
    const part: SlotPart<'span'> = {
      className: 'mine',
      style: { color: 'blue' },
      title: 'Mine',
      'data-part': 'root',
      ref: React.createRef<HTMLSpanElement>(),
    };
    const none = mergeSlotProps(undefined, own);
    expect(mergeSlotProps([], own)).toStrictEqual(none);
    expect(mergeSlotProps([undefined, undefined], own)).toStrictEqual(none);
    expect(mergeSlotProps([undefined, part, undefined], own)).toStrictEqual(
      mergeSlotProps(part, own),
    );
    expect(mergeSlotProps([part], own)).toStrictEqual(mergeSlotProps(part, own));
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

  it('never lets an own __proto__ key (parsed JSON) reach the result, its style or Object.prototype', () => {
    const objectKeys = Object.getOwnPropertyNames(Object.prototype).join();
    const part = asPart(
      JSON.parse(
        '{"__proto__": {"role": "button", "polluted": 1}, "title": "Mine",' +
          ' "style": {"__proto__": {"color": "red"}, "margin": 1}}',
      ),
    );
    const merged = mergeSlotProps([part, part], {
      locked: { role: 'switch' },
      style: { padding: 2 },
    });
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(merged.style)).toBe(Object.prototype);
    expect(Object.hasOwn(merged, '__proto__')).toBe(false);
    expect(merged).toStrictEqual({
      title: 'Mine',
      style: { padding: 2, margin: 1 },
      role: 'switch',
    });
    expect(({} as Props).polluted).toBeUndefined();
    expect(Object.getOwnPropertyNames(Object.prototype).join()).toBe(objectKeys);
  });

  it('keeps the locked attributes when a part carries a prototype with setters', () => {
    const trap = {};
    for (const key of ['role', 'aria-checked']) {
      Object.defineProperty(trap, key, { set() {}, get: () => undefined });
    }
    const part = {};
    Object.defineProperty(part, '__proto__', {
      value: trap,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const merged = mergeSlotProps(asPart(part), {
      locked: { role: 'switch', 'aria-checked': true },
    });
    expect(Object.hasOwn(merged, 'role')).toBe(true);
    expect(renderToStaticMarkup(<span {...merged} />)).toBe(
      '<span role="switch" aria-checked="true"></span>',
    );
  });

  it('copies constructor, toString and prototype keys as plain data', () => {
    const objectKeys = Object.getOwnPropertyNames(Object.prototype).join();
    const merged = mergeSlotProps(asPart({ constructor: 'x', toString: 'y', prototype: 'z' }), {
      locked: { role: 'switch' },
    });
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(merged).toStrictEqual({
      constructor: 'x',
      toString: 'y',
      prototype: 'z',
      role: 'switch',
    });
    expect(Object.getOwnPropertyNames(Object.prototype).join()).toBe(objectKeys);
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
  const ID_LIST_KEY = 'aria-describedby';
  const HANDLER_KEYS = ['onClick', 'onKeyDown', 'onFocus'] as const;
  /** Handler values that are no function: they must never remove or replace ours. */
  const NOT_HANDLERS = [undefined, null, false, 0, '', 'x', {}];
  const IDS = ['id-a', 'id-b shared', 'shared', 'id-c id-a'];
  /** Id-list and ref values a consumer may pass by mistake: skipped, never thrown on. */
  const NOT_IDS = [5, true, ['id-a'], {}];
  const NOT_REFS = [false, 0, '', NaN, 'x', 5];
  const isRefLike = (value: unknown) =>
    typeof value === 'function' || (typeof value === 'object' && value !== null);
  const RUNS = 600;

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

  it('locked attributes win, consumer classes come last, consumer handlers run first and never remove ours', () => {
    const failures: string[] = [];
    for (let run = 1; run <= RUNS; run++) {
      const random = seeded(run);
      const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
      const calls: string[] = [];
      const handler = (name: string, prevent: boolean) => (event: FakeEvent) => {
        calls.push(name);
        if (prevent) event.preventDefault();
      };
      const defaults: Props = {};
      const locked: Props = {};
      const layers: Props[] = random() < 0.35 ? [{}, {}] : [{}];
      for (const key of ATTRIBUTE_KEYS) {
        if (random() < 0.5) defaults[key] = `default-${key}`;
        const l = random();
        if (l < 0.3) locked[key] = `locked-${key}`;
        else if (l < 0.4) locked[key] = undefined;
        for (const [index, layer] of layers.entries()) {
          const c = random();
          if (c < 0.4) layer[key] = `consumer${index}-${key}`;
          else if (c < 0.5) layer[key] = undefined;
          else if (c < 0.6) layer[key] = null;
        }
      }
      if (random() < 0.5) defaults[ID_LIST_KEY] = pick(IDS);
      if (random() < 0.4) locked[ID_LIST_KEY] = random() < 0.8 ? pick(IDS) : undefined;
      for (const layer of layers) {
        if (random() < 0.5) layer[ID_LIST_KEY] = random() < 0.75 ? pick(IDS) : pick(NOT_IDS);
      }
      for (const key of HANDLER_KEYS) {
        if (random() < 0.5) defaults[key] = handler(`default:${key}`, false);
        const l = random();
        if (l < 0.4) locked[key] = handler(`locked:${key}`, false);
        else if (l < 0.5) locked[key] = undefined;
        for (const [index, layer] of layers.entries()) {
          const c = random();
          if (c < 0.5) layer[key] = handler(`consumer${index}:${key}`, random() < 0.3);
          else if (c < 0.8) layer[key] = pick(NOT_HANDLERS);
        }
      }
      const b = random();
      const blockHandlers: SlotPartOwn['blockHandlers'] =
        b < 0.6 ? undefined : b < 0.85 ? HANDLER_KEYS.filter(() => random() < 0.5) : true;
      const isBlocked = (key: string) =>
        blockHandlers === true ||
        (blockHandlers as readonly string[] | undefined)?.includes(key) === true;
      const ownClass = pick([undefined, 'own-a', 'own-a own-b']);
      for (const [index, layer] of layers.entries()) {
        const theirClass = pick([undefined, '', `their-${index}`]);
        if (theirClass !== undefined) layer.className = theirClass;
      }
      const refCalls: string[] = [];
      const refNames = new Map<unknown, string>();
      const refOf = (name: string): unknown => {
        const r = random();
        const ref =
          r < 0.35
            ? (node: unknown) => void refCalls.push(`${name}:${node === null ? 'null' : 'node'}`)
            : r < 0.55
              ? { current: null }
              : r < 0.8
                ? pick(NOT_REFS)
                : undefined;
        if (isRefLike(ref)) refNames.set(ref, name);
        return ref;
      };
      const ownRef = refOf('own') as SlotPartOwn['ref'];
      for (const [index, layer] of layers.entries()) {
        const ref = refOf(`consumer${index}`);
        if (ref !== undefined) layer.ref = ref;
      }
      const own: SlotPartOwn = {
        className: ownClass,
        defaults,
        locked,
        blockHandlers,
        ref: ownRef,
      };
      const parts = layers.map(asPart);
      const merged = mergeSlotProps(parts.length === 1 ? parts[0] : parts, own);
      const fail = (message: string) => failures.push(`run ${run}: ${message}`);

      for (const key of ATTRIBUTE_KEYS) {
        const given = layers.map((layer) => layer[key]).filter((value) => value != null);
        const expected = key in locked ? locked[key] : given.length ? given.at(-1) : defaults[key];
        if (merged[key] !== expected) {
          fail(`${key} is ${String(merged[key])}, not ${String(expected)}`);
        }
      }

      const consumerIds = layers
        .map((layer) => layer[ID_LIST_KEY])
        .filter((ids): ids is string => typeof ids === 'string');
      const ownIds = (ID_LIST_KEY in locked ? locked : defaults)[ID_LIST_KEY] as string | undefined;
      const expectedIds = consumerIds.length
        ? joinIds(ownIds, ...consumerIds)
        : ID_LIST_KEY in locked
          ? locked[ID_LIST_KEY]
          : defaults[ID_LIST_KEY];
      if (merged[ID_LIST_KEY] !== expectedIds) {
        fail(`${ID_LIST_KEY} is ${String(merged[ID_LIST_KEY])}, not ${String(expectedIds)}`);
      }
      for (const id of (ownIds ?? '').split(' ').filter(Boolean)) {
        if (consumerIds.length && !String(merged[ID_LIST_KEY]).split(' ').includes(id)) {
          fail(`the consumer ids removed the component id ${id}`);
        }
      }

      for (const key of HANDLER_KEYS) {
        const consumers = layers
          .map((layer, index) => ({ value: layer[key], name: `consumer${index}:${key}` }))
          .filter(({ value }) => typeof value === 'function' && !isBlocked(key));
        const lockedHandler = typeof locked[key] === 'function' ? locked[key] : undefined;
        const ours =
          lockedHandler ?? (typeof defaults[key] === 'function' ? defaults[key] : undefined);
        if (consumers.length === 0) {
          const expected = key in locked ? locked[key] : defaults[key];
          if (merged[key] !== expected) fail(`${key} is not ours unchanged`);
          if (!(key in locked) && !(key in defaults) && key in merged) {
            fail(`${key} forwarded a value that is no handler, or a blocked one`);
          }
          continue;
        }
        calls.length = 0;
        const event = fire(merged, key);
        const expectedCalls = consumers.map(({ name }) => name);
        if (ours && !event.defaultPrevented) {
          expectedCalls.push(lockedHandler ? `locked:${key}` : `default:${key}`);
        }
        if (calls.join() !== expectedCalls.join()) {
          fail(`${key} ran ${calls.join(', ')}, not ${expectedCalls.join(', ')}`);
        }
      }

      const theirClasses = layers.map((layer) => layer.className).filter(Boolean);
      const expectedClass = theirClasses.length
        ? [ownClass, ...theirClasses].filter(Boolean).join(' ')
        : ownClass;
      if (merged.className !== expectedClass) {
        fail(`className is ${String(merged.className)}, not ${String(expectedClass)}`);
      }
      if (expectedClass === undefined && 'className' in merged) fail('className without a class');

      // Refs: the component's, then each part's, every one that is a function or an object.
      const refs = [ownRef, ...layers.map((layer) => layer.ref)].filter(isRefLike);
      if (refs.length === 0 && 'ref' in merged) fail('ref without a ref');
      if (refs.length === 1 && merged.ref !== refs[0]) fail('one ref is not passed through');
      if (refs.length > 1) {
        const node = {};
        refCalls.length = 0;
        const cleanup = (merged.ref as (node: unknown) => () => void)(node);
        const callbacks = refs.filter((ref) => typeof ref === 'function');
        const attached = callbacks.map((ref) => `${refNames.get(ref)}:node`);
        if (refCalls.join() !== attached.join()) {
          fail(`the refs got ${refCalls.join(', ')}, not ${attached.join(', ')}`);
        }
        const objects = refs.filter((ref) => typeof ref === 'object') as { current: unknown }[];
        if (objects.some((ref) => ref.current !== node)) fail('an object ref was not attached');
        cleanup();
        if (objects.some((ref) => ref.current !== null)) fail('an object ref was not detached');
      }

      const allowed = new Set(['className', ...Object.keys(defaults), ...Object.keys(locked)]);
      for (const layer of layers) {
        for (const key of Object.keys(layer)) {
          const value = layer[key];
          const forwarded = (HANDLER_KEYS as readonly string[]).includes(key)
            ? typeof value === 'function' && !isBlocked(key)
            : key === ID_LIST_KEY
              ? typeof value === 'string'
              : key === 'ref'
                ? isRefLike(value)
                : value != null;
          if (forwarded) allowed.add(key);
        }
      }
      if (refs.length) allowed.add('ref');
      else allowed.delete('ref');
      for (const key of Object.keys(merged)) {
        if (!allowed.has(key)) fail(`unexpected key ${key}`);
      }

      const none = mergeSlotProps(undefined, own);
      for (const empty of [mergeSlotProps({}, own), mergeSlotProps([], own)]) {
        if (Object.keys(none).join() !== Object.keys(empty).join()) {
          fail('an empty part gives other keys than no part');
        }
        for (const key of Object.keys(none)) {
          if (none[key] !== empty[key]) fail(`an empty part changes ${key}`);
        }
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

  it('imports the merge helpers and the id-list rule at run time, and types only otherwise', () => {
    const statements = importStatements(slotPropsSource);
    expect(statements.filter(({ typeOnly }) => !typeOnly).map(({ text }) => text)).toEqual([
      "import { joinIds } from './aria'",
      "import { cn } from './cn'",
      "import { composeEventHandlers } from './composeEventHandlers'",
      "import { ID_LIST_KEYS } from './mergeProps'",
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

  it('takes a value typed by an interface, and what getNativeElementProps returns', () => {
    // React's own interfaces and an interface of yours: no `data-*` index of their own.
    const attributes: React.ButtonHTMLAttributes<HTMLButtonElement> = { title: 'Attributes' };
    const componentProps: React.ComponentProps<'button'> = { title: 'Props' };
    interface ButtonPartOfMine {
      title?: string;
      onClick?: React.MouseEventHandler<HTMLButtonElement>;
    }
    const mine: ButtonPartOfMine = { title: 'Mine' };
    const fromAttributes: SlotPart<'button'> = attributes;
    const fromProps: SlotPart<'button'> = componentProps;
    const fromMine: SlotPart<'button'> = mine;
    const svg: React.SVGProps<SVGSVGElement> = { focusable: 'false' };
    const fromSvg: SlotPart<'svg'> = svg;
    // What getNativeElementProps returns, `data-*` attributes included.
    const native: NativeElementProps<'button'> = { title: 'Native', 'data-part': 'native' };
    const fromNative: SlotPart<'button'> = native;
    expect([fromAttributes, fromProps, fromMine, fromSvg, fromNative]).toHaveLength(5);

    // mergeSlotProps takes them too, an HTMLAttributes value among them.
    const html: React.HTMLAttributes<HTMLElement> = { title: 'Html' };
    expect(mergeSlotProps(html, {})).toStrictEqual({ title: 'Html' });
    expect(mergeSlotProps(attributes, {})).toStrictEqual({ title: 'Attributes' });
    expect(mergeSlotProps(native, {})).toStrictEqual({ title: 'Native', 'data-part': 'native' });
  });

  it('still rejects what a part never takes in an object literal, next to a valid prop', () => {
    // @ts-expect-error a part never takes children, also next to an attribute it takes
    const withChildren: SlotPart<'span'> = { title: 'T', children: 'Replaced' };
    // @ts-expect-error nor `as`
    const withAs: SlotPart<'span'> = { title: 'T', as: 'div' };
    // @ts-expect-error nor `key`
    const withKey: SlotPart<'span'> = { title: 'T', key: 'k' };
    // @ts-expect-error nor markup of its own
    const withHtml: SlotPart<'span'> = { title: 'T', dangerouslySetInnerHTML: { __html: '' } };
    // @ts-expect-error a class name is a string, not an array
    const withClassList: SlotPart<'span'> = { title: 'T', className: ['a', 'b'] };
    // @ts-expect-error a data attribute is a string, a number or a boolean
    const withObjectData: SlotPart<'span'> = { title: 'T', 'data-part': { nested: true } };
    const svgRef = React.createRef<SVGSVGElement>();
    // @ts-expect-error a button part's ref takes a button, not an svg
    const withWrongRef: SlotPart<'button'> = { title: 'T', ref: svgRef };
    expect([
      withChildren,
      withAs,
      withKey,
      withHtml,
      withClassList,
      withObjectData,
      withWrongRef,
    ]).toHaveLength(7);
  });

  it('infers an svg part, and types the ref of a part with SlotPartWithRef', () => {
    const inferred = <E extends keyof React.JSX.IntrinsicElements = 'span'>(
      part: SlotPart<E> | readonly (SlotPart<E> | undefined)[] | undefined,
    ): E => part as unknown as E;
    const parts: { icon?: SlotPart<'svg'>; heading?: SlotPart<'h3'> } = {};
    expectTypeOf(inferred(parts.icon)).toEqualTypeOf<'svg'>();
    expectTypeOf(inferred(parts.heading)).toEqualTypeOf<'h3'>();

    expectTypeOf<SlotPartWithRef<'span', HTMLElement>['ref']>().toEqualTypeOf<
      React.Ref<HTMLElement> | undefined
    >();
    const elementRef = React.createRef<HTMLElement>();
    const divRef = React.createRef<HTMLDivElement>();
    const svgRef = React.createRef<SVGSVGElement>();
    const content: SlotPartWithRef<'span', HTMLElement> = {
      title: 'Content',
      'data-part': 'content',
      ref: elementRef,
    };
    const list: SlotPartWithRef<'ol', HTMLElement> = { reversed: true, ref: divRef };
    const icon: SlotPartWithRef<'span', HTMLSpanElement | SVGSVGElement> = { ref: svgRef };
    const attributes: React.HTMLAttributes<HTMLElement> = { title: 'Attributes' };
    const fromAttributes: SlotPartWithRef<'span', HTMLElement> = attributes;
    // @ts-expect-error the rest is the props of the element: a span part takes no `reversed`
    const notOl: SlotPartWithRef<'span', HTMLElement> = { reversed: true };
    // @ts-expect-error and no children
    const withChildren: SlotPartWithRef<'span', HTMLElement> = { title: 'T', children: 'x' };
    // @ts-expect-error and checks its data attributes
    const withObjectData: SlotPartWithRef<'span', HTMLElement> = { 'data-part': {} };
    // @ts-expect-error its ref takes the elements it names only
    const withSvgRef: SlotPartWithRef<'span', HTMLElement> = { ref: svgRef };
    expect([
      content,
      list,
      icon,
      fromAttributes,
      notOl,
      withChildren,
      withObjectData,
      withSvgRef,
    ]).toHaveLength(8);
    expect(mergeSlotProps(content, {})).toMatchObject({ title: 'Content', ref: elementRef });
  });

  it('infers the element from a typed part, and falls back to a span', () => {
    type Signature = <E extends keyof React.JSX.IntrinsicElements = 'span'>(
      part: SlotPart<E> | readonly (SlotPart<E> | undefined)[] | undefined,
      own: SlotPartOwn,
    ) => Record<string, unknown>;
    expectTypeOf(mergeSlotProps).toEqualTypeOf<Signature>();
    // The same signature, returning the element it infers. A part of another element would be
    // assignable to a span part anyway, so only inference shows which element a call takes.
    const inferred = <E extends keyof React.JSX.IntrinsicElements = 'span'>(
      part: SlotPart<E> | readonly (SlotPart<E> | undefined)[] | undefined,
      own: SlotPartOwn,
    ): E => [part, own] as unknown as E;
    const slotProps: {
      root?: SlotPart<'span'>;
      input?: SlotPart<'input'>;
      button?: SlotPart<'button'>;
    } = {};
    expectTypeOf(inferred(slotProps.input, {})).toEqualTypeOf<'input'>();
    expectTypeOf(inferred([slotProps.input, undefined], {})).toEqualTypeOf<'input'>();
    // A span root and an input part together, in either order: the span, which both parts fit.
    expectTypeOf(inferred([slotProps.root, slotProps.input], {})).toEqualTypeOf<'span'>();
    expectTypeOf(inferred([slotProps.input, slotProps.root], {})).toEqualTypeOf<'span'>();
    expectTypeOf(inferred([], {})).toEqualTypeOf<'span'>();

    // Input's recipe, with its root part's ref typed for any element (the JSDoc's advice).
    type InputRootPart = Omit<SlotPart<'span'>, 'ref'> & { ref?: React.Ref<HTMLElement> };
    const input: { root?: InputRootPart; input?: SlotPart<'input'> } = {};
    expect(mergeSlotProps([input.root, input.input], {})).toStrictEqual({});
    expect(mergeSlotProps<'span' | 'input'>([input.root, input.input], {})).toStrictEqual({});
    expect(mergeSlotProps<'span' | 'input'>([slotProps.root, slotProps.input], {})).toStrictEqual(
      {},
    );
    // @ts-expect-error a span root is no input part
    expect(mergeSlotProps<'input'>([slotProps.root, slotProps.input], {})).toStrictEqual({});
    expectTypeOf(inferred(slotProps.button, {})).toEqualTypeOf<'button'>();
    expectTypeOf(inferred(undefined, {})).toEqualTypeOf<'span'>();
    expectTypeOf(inferred({ title: 'Inline' }, {})).toEqualTypeOf<'span'>();
    expectTypeOf<SlotPart<'input'>>().toExtend<SlotPart<'span'>>();
  });

  it('returns the props to spread', () => {
    expectTypeOf(mergeSlotProps<'input'>)
      .parameter(0)
      .toEqualTypeOf<SlotPart<'input'> | readonly (SlotPart<'input'> | undefined)[] | undefined>();
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
    expect(mergeSlotProps([slotProps.track, slotProps.input], {})).toStrictEqual({});
    // @ts-expect-error a part in an array takes no children either
    expect(mergeSlotProps([{ children: 'x' }], {})).toStrictEqual({});

    expectTypeOf<SlotPartOwn['blockHandlers']>().toEqualTypeOf<
      true | readonly `on${Capitalize<string>}`[] | undefined
    >();
    const blockAll: SlotPartOwn = { blockHandlers: true };
    const blockSome: SlotPartOwn = { blockHandlers: ['onClick'] as const };
    // @ts-expect-error false is not a value: leave the option out
    const blockNone: SlotPartOwn = { blockHandlers: false };
    // @ts-expect-error a handler key is on and a capital letter: a typo is caught
    const blockTypo: SlotPartOwn = { blockHandlers: ['onclick'] };
    // @ts-expect-error nor is an attribute a handler key
    const blockAttribute: SlotPartOwn = { blockHandlers: ['title'] };
    expect([blockAll, blockSome, blockNone, blockTypo, blockAttribute]).toHaveLength(5);
  });
});

interface ToggleProps {
  /** Focusable but inert: no toggle, and the consumer's click never runs (C-DISABLED). */
  disabledFocusable?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  slotProps?: { root?: SlotPart<'button'>; thumb?: SlotPart<'span'> };
}

/** A component with two parts, as a rollout writes them. */
function Toggle({ disabledFocusable, onPressedChange, slotProps }: ToggleProps) {
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
          'aria-disabled': disabledFocusable || undefined,
          onClick: (event: React.MouseEvent) => {
            if (disabledFocusable) {
              event.preventDefault();
              return;
            }
            setPressed(!pressed);
            onPressedChange?.(!pressed);
          },
        },
        blockHandlers: disabledFocusable ? ['onClick'] : undefined,
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

describe('HIDDEN_PART_LOCKS', () => {
  it('locks the hidden state of a part unset, so a part cannot hide what it holds', () => {
    expect(HIDDEN_PART_LOCKS).toEqual({
      hidden: undefined,
      inert: undefined,
      'aria-hidden': undefined,
    });
    expect(Object.keys(HIDDEN_PART_LOCKS)).toEqual(['hidden', 'inert', 'aria-hidden']);
    const merged = mergeSlotProps<'div'>(
      { hidden: true, inert: true, 'aria-hidden': true, title: 'Mine' },
      { className: 'part', locked: HIDDEN_PART_LOCKS },
    );
    expect(merged).toEqual({
      className: 'part',
      title: 'Mine',
      hidden: undefined,
      inert: undefined,
      'aria-hidden': undefined,
    });
  });
});

describe('BUTTON_PART_LOCKS', () => {
  it('holds every key of HIDDEN_PART_LOCKS with the same value (the written-out copy cannot drift)', () => {
    for (const [key, value] of Object.entries(HIDDEN_PART_LOCKS)) {
      expect(BUTTON_PART_LOCKS, key).toHaveProperty([key], value);
    }
  });

  it("locks a button type and unset the tab stop and the disabled states, before the button's own attributes", () => {
    expect(BUTTON_PART_LOCKS).toEqual({
      type: 'button',
      tabIndex: undefined,
      disabled: undefined,
      'aria-disabled': undefined,
      'data-disabled': undefined,
      'data-disabled-focusable': undefined,
      hidden: undefined,
      inert: undefined,
      'aria-hidden': undefined,
    });
    const merged = mergeSlotProps<'button'>(
      { type: 'submit', tabIndex: 0, disabled: true, hidden: true, title: 'Mine' },
      { className: 'part', locked: { ...BUTTON_PART_LOCKS, tabIndex: -1 } },
    );
    expect(merged).toEqual({
      className: 'part',
      title: 'Mine',
      ...BUTTON_PART_LOCKS,
      tabIndex: -1,
    });
  });
});

describe('composeAfterPart', () => {
  it("runs the part's handler first, then ours, with the same event", () => {
    const calls: string[] = [];
    const event = fakeEvent();
    const theirs = vi.fn((received: FakeEvent) => {
      expect(received).toBe(event);
      calls.push('theirs');
    });
    const ours = vi.fn((received: FakeEvent) => {
      expect(received).toBe(event);
      calls.push('ours');
    });
    const composed = composeAfterPart<FakeEvent>(theirs, ours);
    expect(composed).toBeTypeOf('function');
    composed!(event);
    expect(calls).toEqual(['theirs', 'ours']);
    expect(theirs).toHaveBeenCalledTimes(1);
    expect(ours).toHaveBeenCalledTimes(1);
  });

  it("runs ours even when the part's handler prevented the default (checkDefaultPrevented: false)", () => {
    const ours = vi.fn();
    const composed = composeAfterPart<FakeEvent>(
      (event: FakeEvent) => event.preventDefault(),
      ours,
    );
    const event = fakeEvent();
    composed!(event);
    expect(event.defaultPrevented).toBe(true);
    expect(ours).toHaveBeenCalledTimes(1);
    expect(ours).toHaveBeenCalledWith(event);
  });

  it("runs ours when the part's handler throws, and lets the error go on", () => {
    const calls: string[] = [];
    const failure = new Error('part handler failed');
    const composed = composeAfterPart<FakeEvent>(
      () => {
        calls.push('theirs');
        throw failure;
      },
      () => calls.push('ours'),
    );
    expect(() => composed!(fakeEvent())).toThrow(failure);
    expect(calls).toEqual(['theirs', 'ours']);
  });

  it('gives ours itself without a part handler, and skips a part value that is not a function', () => {
    const ours = vi.fn();
    expect(composeAfterPart<FakeEvent>(undefined, ours)).toBe(ours);
    // An untyped caller's value: neither called nor in the way of ours.
    for (const value of ['not a handler', 0, null, true, {}]) {
      const composed = composeAfterPart<FakeEvent>(value, ours);
      expect(composed, String(value)).toBe(ours);
      expect(() => composed!(fakeEvent())).not.toThrow();
    }
    expect(ours).toHaveBeenCalledTimes(5);
  });

  it('gives the part handler alone when there is no work of ours, and undefined without either', () => {
    const theirs = vi.fn();
    const composed = composeAfterPart<FakeEvent>(theirs, undefined);
    const event = fakeEvent();
    composed!(event);
    expect(theirs).toHaveBeenCalledWith(event);
    expect(composeAfterPart<FakeEvent>(undefined, undefined)).toBeUndefined();
    expect(composeAfterPart<FakeEvent>('not a handler', undefined)).toBeUndefined();
  });
});

describe('lockPositionStyle', () => {
  const position: React.CSSProperties = { position: 'fixed', top: 0, left: 8, maxHeight: '50vh' };

  it('keeps the position style itself without a part style', () => {
    expect(lockPositionStyle(undefined, position)).toBe(position);
  });

  it("puts the part's keys first and every key the positioning sets over them", () => {
    expect(lockPositionStyle({ top: 99, minWidth: 120, zIndex: 3 }, position)).toEqual({
      top: 0,
      minWidth: 120,
      zIndex: 3,
      position: 'fixed',
      left: 8,
      maxHeight: '50vh',
    });
  });
});
