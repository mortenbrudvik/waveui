import type * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  NATIVE_DISABLED_ELEMENTS,
  needsButtonSemantics,
  useButtonSemantics,
} from '../Button.semantics';
import type { ButtonSemantics, ButtonSemanticsOptions } from '../Button.semantics';

/** The disabled states a Button or Link can be in. */
type State = 'enabled' | 'disabled' | 'disabledFocusable' | 'disabled and disabledFocusable';

const STATES: Record<State, Pick<ButtonSemanticsOptions, 'disabled' | 'disabledFocusable'>> = {
  enabled: { disabled: false, disabledFocusable: false },
  disabled: { disabled: true, disabledFocusable: false },
  disabledFocusable: { disabled: false, disabledFocusable: true },
  'disabled and disabledFocusable': { disabled: true, disabledFocusable: true },
};

/** The attributes of a focusable disabled control (focusableDisabledProps with `reachable`). */
const FOCUSABLE_DISABLED = {
  'aria-disabled': true,
  'data-disabled': '',
  'data-disabled-focusable': '',
};

/** The attributes of a disabled element that has no native `disabled` attribute. */
const ARIA_DISABLED = { 'aria-disabled': true, 'data-disabled': '', tabIndex: -1 };

/** Renders the hook once and returns its result. */
function semanticsOf(
  tag: string | null,
  href: unknown,
  state: State,
  handlers: Partial<ButtonSemanticsOptions> = {},
): ButtonSemantics {
  const { result } = renderHook(() =>
    useButtonSemantics({ tag, href, ...STATES[state], ...handlers }),
  );
  return result.current;
}

/** A stand-in for a React synthetic event: records `preventDefault` and `stopPropagation`. */
interface FakeEvent {
  key: string;
  target: HTMLElement;
  currentTarget: HTMLElement;
  defaultPrevented: boolean;
  preventDefault: Mock<() => void>;
  stopPropagation: Mock<() => void>;
}

function fakeEvent(key = '', element: HTMLElement = document.createElement('div')): FakeEvent {
  const event: FakeEvent = {
    key,
    target: element,
    currentTarget: element,
    defaultPrevented: false,
    preventDefault: vi.fn(() => {
      event.defaultPrevented = true;
    }),
    stopPropagation: vi.fn(),
  };
  return event;
}

const asMouse = (event: FakeEvent) => event as unknown as React.MouseEvent<HTMLElement>;
const asKey = (event: FakeEvent) => event as unknown as React.KeyboardEvent<HTMLElement>;
const asFocus = (event: FakeEvent) => event as unknown as React.FocusEvent<HTMLElement>;

describe('Button semantics', () => {
  it('NATIVE_DISABLED_ELEMENTS lists the form controls with a native disabled attribute', () => {
    expect(Array.from(NATIVE_DISABLED_ELEMENTS).sort()).toEqual([
      'button',
      'input',
      'select',
      'textarea',
    ]);
  });

  describe('needsButtonSemantics', () => {
    const ROWS: ReadonlyArray<readonly [string | null, unknown, boolean]> = [
      ['a', undefined, true],
      ['a', null, true],
      ['a', '', false],
      ['a', '/docs', false],
      ['a', '#top', false],
      ['button', undefined, false],
      ['input', undefined, false],
      ['select', undefined, false],
      ['textarea', undefined, false],
      ['summary', undefined, false],
      ['div', undefined, true],
      ['span', undefined, true],
      ['li', '/docs', true],
      [null, undefined, false],
      [null, '/home', false],
    ];

    it.each(ROWS)('tag %s with href %j needs button semantics: %s', (tag, href, expected) => {
      expect(needsButtonSemantics(tag, href)).toBe(expected);
    });
  });

  describe('defaults and enforced attributes per tag and state', () => {
    type Row = readonly [
      name: string,
      tag: string | null,
      href: unknown,
      state: State,
      defaults: Record<string, unknown>,
      enforced: Record<string, unknown>,
    ];
    const ROWS: readonly Row[] = [
      ['<button>', 'button', undefined, 'enabled', { type: 'button' }, {}],
      [
        '<button>',
        'button',
        undefined,
        'disabled',
        { type: 'button' },
        { disabled: true, 'data-disabled': '' },
      ],
      [
        '<button>',
        'button',
        undefined,
        'disabledFocusable',
        { type: 'button' },
        FOCUSABLE_DISABLED,
      ],
      [
        '<button>',
        'button',
        undefined,
        'disabled and disabledFocusable',
        { type: 'button' },
        FOCUSABLE_DISABLED,
      ],
      ['<input>', 'input', undefined, 'enabled', {}, {}],
      ['<input>', 'input', undefined, 'disabled', {}, { disabled: true, 'data-disabled': '' }],
      ['<input>', 'input', undefined, 'disabledFocusable', {}, FOCUSABLE_DISABLED],
      ['<a href>', 'a', '/docs', 'enabled', {}, {}],
      ['<a href="">', 'a', '', 'enabled', {}, {}],
      [
        '<a href>',
        'a',
        '/docs',
        'disabled',
        { role: 'link' },
        { href: undefined, ...ARIA_DISABLED },
      ],
      [
        '<a href>',
        'a',
        '/docs',
        'disabledFocusable',
        { role: 'link', tabIndex: 0 },
        { href: undefined, ...FOCUSABLE_DISABLED },
      ],
      [
        '<a href>',
        'a',
        '/docs',
        'disabled and disabledFocusable',
        { role: 'link', tabIndex: 0 },
        { href: undefined, ...FOCUSABLE_DISABLED },
      ],
      ['<a> without href', 'a', undefined, 'enabled', { role: 'button', tabIndex: 0 }, {}],
      ['<a href={null}>', 'a', null, 'enabled', { role: 'button', tabIndex: 0 }, {}],
      [
        '<a> without href',
        'a',
        undefined,
        'disabled',
        { role: 'button', tabIndex: 0 },
        { href: undefined, ...ARIA_DISABLED },
      ],
      [
        '<a> without href',
        'a',
        undefined,
        'disabledFocusable',
        { role: 'button', tabIndex: 0 },
        { href: undefined, ...FOCUSABLE_DISABLED },
      ],
      ['<div>', 'div', undefined, 'enabled', { role: 'button', tabIndex: 0 }, {}],
      ['<div>', 'div', undefined, 'disabled', { role: 'button', tabIndex: 0 }, ARIA_DISABLED],
      [
        '<div>',
        'div',
        undefined,
        'disabledFocusable',
        { role: 'button', tabIndex: 0 },
        FOCUSABLE_DISABLED,
      ],
      ['a custom component', null, '/home', 'enabled', {}, {}],
      ['a custom component', null, '/home', 'disabled', {}, ARIA_DISABLED],
      ['a custom component', null, undefined, 'disabledFocusable', {}, FOCUSABLE_DISABLED],
      [
        'a custom component',
        null,
        undefined,
        'disabled and disabledFocusable',
        {},
        FOCUSABLE_DISABLED,
      ],
    ];

    it.each(ROWS)('%s, %s', (_name, tag, href, state, defaults, enforced) => {
      const semantics = semanticsOf(tag, href, state);
      expect(semantics.defaults).toStrictEqual(defaults);
      expect(semantics.enforced).toStrictEqual(enforced);
    });
  });

  describe('handlers', () => {
    it.each([
      ['<button>', 'button', undefined],
      ['<a href>', 'a', '/docs'],
      ['a custom component', null, undefined],
    ] as const)(
      'an enabled %s gets only the handlers the consumer passed, unchanged',
      (_name, tag, href) => {
        expect(semanticsOf(tag, href, 'enabled').handlers).toStrictEqual({});
        const onClick = vi.fn();
        const onKeyDown = vi.fn();
        expect(semanticsOf(tag, href, 'enabled', { onClick, onKeyDown }).handlers).toStrictEqual({
          onClick,
          onKeyDown,
        });
      },
    );

    it.each([
      ['<div>', 'div', undefined],
      ['<a> without href', 'a', undefined],
    ] as const)(
      'an enabled %s activates on Enter keydown and on a Space keydown/keyup pair',
      (_name, tag, href) => {
        const onClick = vi.fn();
        const { handlers } = semanticsOf(tag, href, 'enabled', { onClick });
        expect(handlers.onClick).toBe(onClick);
        const element = document.createElement(tag);
        const click = vi.spyOn(element, 'click').mockImplementation(() => {});

        const enter = fakeEvent('Enter', element);
        handlers.onKeyDown?.(asKey(enter));
        expect(enter.preventDefault).toHaveBeenCalled();
        expect(click).toHaveBeenCalledTimes(1);

        // A Space keyup without a keydown does not activate; the pair does, on the keyup.
        handlers.onKeyUp?.(asKey(fakeEvent(' ', element)));
        expect(click).toHaveBeenCalledTimes(1);
        const spaceDown = fakeEvent(' ', element);
        handlers.onKeyDown?.(asKey(spaceDown));
        expect(spaceDown.preventDefault).toHaveBeenCalled();
        expect(click).toHaveBeenCalledTimes(1);
        handlers.onKeyUp?.(asKey(fakeEvent(' ', element)));
        expect(click).toHaveBeenCalledTimes(2);

        // Moving focus between keydown and keyup cancels the Space activation.
        handlers.onKeyDown?.(asKey(fakeEvent(' ', element)));
        handlers.onBlur?.(asFocus(fakeEvent('', element)));
        handlers.onKeyUp?.(asKey(fakeEvent(' ', element)));
        expect(click).toHaveBeenCalledTimes(2);
      },
    );

    const BLOCKED: ReadonlyArray<readonly [string, string | null, unknown, State]> = [
      ['<button>', 'button', undefined, 'disabledFocusable'],
      ['<a href>', 'a', '/docs', 'disabled'],
      ['<a href>', 'a', '/docs', 'disabledFocusable'],
      ['<a> without href', 'a', undefined, 'disabledFocusable'],
      ['<div>', 'div', undefined, 'disabled'],
      ['<div>', 'div', undefined, 'disabledFocusable'],
      ['a custom component', null, undefined, 'disabled'],
      ['a custom component', null, undefined, 'disabled and disabledFocusable'],
    ];

    it.each(BLOCKED)(
      '%s (%s): a click is prevented and stopped, the consumer onClick is not called',
      (_name, tag, href, state) => {
        const onClick = vi.fn();
        const { handlers } = semanticsOf(tag, href, state, { onClick });
        const click = fakeEvent();
        handlers.onClick?.(asMouse(click));
        expect(click.preventDefault).toHaveBeenCalled();
        expect(click.stopPropagation).toHaveBeenCalled();
        expect(onClick).not.toHaveBeenCalled();
      },
    );

    it.each(BLOCKED)(
      '%s (%s): Enter and Space keydowns and the Space keyup are prevented and not forwarded; other keys are forwarded',
      (_name, tag, href, state) => {
        const onKeyDown = vi.fn();
        const onKeyUp = vi.fn();
        const element = document.createElement('div');
        const click = vi.spyOn(element, 'click');
        const { handlers } = semanticsOf(tag, href, state, { onKeyDown, onKeyUp });

        for (const key of ['Enter', ' ']) {
          const down = fakeEvent(key, element);
          handlers.onKeyDown?.(asKey(down));
          expect(down.preventDefault).toHaveBeenCalled();
        }
        const spaceUp = fakeEvent(' ', element);
        handlers.onKeyUp?.(asKey(spaceUp));
        expect(spaceUp.preventDefault).toHaveBeenCalled();
        expect(onKeyDown).not.toHaveBeenCalled();
        expect(onKeyUp).not.toHaveBeenCalled();

        // Enter activates on keydown, so its keyup activates nothing: a focusable disabled control
        // forwards it like any other key; a disabled non-native element blocks it (as in 0.5).
        const focusable = state.includes('disabledFocusable');
        const enterUp = fakeEvent('Enter', element);
        handlers.onKeyUp?.(asKey(enterUp));
        expect(enterUp.preventDefault).toHaveBeenCalledTimes(focusable ? 0 : 1);
        expect(onKeyUp).toHaveBeenCalledTimes(focusable ? 1 : 0);
        expect(click).not.toHaveBeenCalled();

        const arrow = fakeEvent('ArrowDown', element);
        handlers.onKeyDown?.(asKey(arrow));
        handlers.onKeyUp?.(asKey(arrow));
        expect(arrow.preventDefault).not.toHaveBeenCalled();
        expect(onKeyDown).toHaveBeenCalledTimes(1);
        expect(onKeyUp).toHaveBeenCalledTimes(focusable ? 2 : 1);
      },
    );

    it('a natively disabled <button> keeps the consumer handlers (the browser blocks activation)', () => {
      const onClick = vi.fn();
      const onBlur = vi.fn();
      expect(
        semanticsOf('button', undefined, 'disabled', { onClick, onBlur }).handlers,
      ).toStrictEqual({ onClick, onBlur });
    });
  });
});
