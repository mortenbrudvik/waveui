import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { resolveSlot, renderSlot, VOID_ELEMENTS } from '../slot';
import type { ResolvedSlot, Slot, SlotObject } from '../slot';
import type * as Types from '../types';
import { __resetWarnings } from '../dev';

afterEach(() => {
  vi.restoreAllMocks();
  __resetWarnings();
});

describe('resolveSlot', () => {
  it('returns null for null', () => {
    expect(resolveSlot(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(resolveSlot(undefined)).toBeNull();
  });

  it('returns null for false', () => {
    expect(resolveSlot(false)).toBeNull();
  });

  it('returns null for true (renders nothing, like false)', () => {
    expect(resolveSlot(true)).toBeNull();
  });

  it('wraps string ReactNode in defaultAs', () => {
    const result = resolveSlot('hello', 'span');
    expect(result).not.toBeNull();
    expect(result!.Component).toBe('span');
    expect(result!.children).toBe('hello');
  });

  it('wraps number ReactNode in defaultAs', () => {
    const result = resolveSlot(42, 'span');
    expect(result).not.toBeNull();
    expect(result!.Component).toBe('span');
    expect(result!.children).toBe(42);
  });

  it('wraps ReactElement in defaultAs', () => {
    const el = React.createElement('b', null, 'bold');
    const result = resolveSlot(el, 'div');
    expect(result).not.toBeNull();
    expect(result!.Component).toBe('div');
    expect(result!.children).toBe(el);
  });

  it('defaults to span when no defaultAs', () => {
    const result = resolveSlot('hi');
    expect(result!.Component).toBe('span');
  });

  it('extracts as/children/className from SlotObject', () => {
    const result = resolveSlot({
      as: 'div',
      children: 'content',
      className: 'custom',
    });
    expect(result!.Component).toBe('div');
    expect(result!.children).toBe('content');
    expect(result!.props.className).toBe('custom');
    expect(result!.props).not.toHaveProperty('as');
    expect(result!.props).not.toHaveProperty('children');
  });

  it('uses defaultAs when SlotObject has no as', () => {
    const result = resolveSlot({ children: 'content' }, 'div');
    expect(result!.Component).toBe('div');
  });

  it('merges baseClassName with SlotObject className', () => {
    const result = resolveSlot({ className: 'custom' }, 'span', 'base');
    expect(result!.props.className).toBe('base custom');
  });

  it('lets the slot className win over a conflicting baseClassName (table-core#27)', () => {
    expect(resolveSlot({ className: 'px-2' }, 'span', 'px-4')!.props.className).toBe('px-2');
    expect(
      resolveSlot({ className: 'text-primary' }, 'span', 'text-body-1 text-foreground')!.props
        .className,
    ).toBe('text-body-1 text-primary');
  });

  it('passes through extra props from SlotObject (typed, no cast)', () => {
    const result = resolveSlot({
      children: 'x',
      'data-foo': 'bar',
      title: 'Tip',
      style: { color: 'red' },
    });
    expect(result!.props['data-foo']).toBe('bar');
    expect(result!.props.title).toBe('Tip');
    expect(result!.props.style).toEqual({ color: 'red' });
  });

  it('applies baseClassName for ReactNode shorthand', () => {
    const result = resolveSlot('text', 'span', 'base-class');
    expect(result!.props.className).toBe('base-class');
  });

  describe('defaultProps (4th argument, button-provider#21)', () => {
    it('applies defaultProps to shorthand wrappers', () => {
      const result = resolveSlot('★', 'span', 'shrink-0', { 'aria-hidden': true });
      expect(result!.props).toEqual({ 'aria-hidden': true, className: 'shrink-0' });
    });

    it('lets the slot object override defaultProps', () => {
      const result = resolveSlot({ 'aria-hidden': false, children: 'x' }, 'span', 'shrink-0', {
        'aria-hidden': true,
        role: 'presentation',
      });
      expect(result!.props['aria-hidden']).toBe(false);
      expect(result!.props.role).toBe('presentation');
    });

    it('does not let defaultProps override the merged className', () => {
      const result = resolveSlot({ className: 'px-2' }, 'span', 'px-4', { className: 'ignored' });
      expect(result!.props.className).toBe('px-2');
    });
  });

  describe('isSlotObject accepts only plain objects (table-core#18)', () => {
    it('treats an array as children, not as a slot object', () => {
      const result = resolveSlot(['$', '5'], 'span');
      expect(result!.Component).toBe('span');
      expect(result!.children).toEqual(['$', '5']);
    });

    it('treats a Set as children', () => {
      const set = new Set(['a', 'b']);
      const result = resolveSlot(set, 'span');
      expect(result!.Component).toBe('span');
      expect(Array.from(result!.children as Iterable<React.ReactNode>)).toEqual(['a', 'b']);
      expect(result!.props).toEqual({ className: undefined });
    });

    it('treats a generator as children and materialises it once', () => {
      function* items() {
        yield 'x';
        yield 'y';
      }
      const gen = items();
      const first = resolveSlot(gen, 'span');
      const second = resolveSlot(gen, 'span');
      expect(first!.children).toEqual(['x', 'y']);
      // A second resolution (StrictMode double render) sees the same items, not an exhausted iterator.
      expect(second!.children).toEqual(['x', 'y']);
    });

    it('passes a thenable through as a node instead of reading it as a slot object', () => {
      const promise = Promise.resolve('later');
      const result = resolveSlot(promise as unknown as Slot, 'span');
      expect(result!.Component).toBe('span');
      expect(result!.children).toBe(promise);
    });

    it('does not treat a portal or other $$typeof objects as slot objects', () => {
      const fake = { $$typeof: Symbol.for('react.portal'), children: 'x' };
      const result = resolveSlot(fake as unknown as Slot, 'span');
      expect(result!.children).toBe(fake);
    });

    it('does not treat class instances as slot objects', () => {
      class Thing {
        className = 'nope';
      }
      const thing = new Thing();
      const result = resolveSlot(thing as unknown as Slot, 'span');
      expect(result!.children).toBe(thing);
      expect(result!.props.className).toBeUndefined();
    });

    it('accepts a null-prototype object as a slot object', () => {
      const obj = Object.assign(Object.create(null) as object, { className: 'px-1' });
      const result = resolveSlot(obj as Slot, 'span');
      expect(result!.props.className).toBe('px-1');
    });
  });

  describe('void default tags (data-display#3)', () => {
    it('exports the HTML void element names', () => {
      expect(VOID_ELEMENTS.has('img')).toBe(true);
      expect(VOID_ELEMENTS.has('input')).toBe(true);
      expect(VOID_ELEMENTS.has('br')).toBe(true);
      expect(VOID_ELEMENTS.has('hr')).toBe(true);
      expect(VOID_ELEMENTS.has('span')).toBe(false);
    });

    it('returns a ReactElement slot itself (className merged, defaultProps underneath)', () => {
      const el = React.createElement('img', { src: 'a.png', alt: 'A', className: 'rounded-sm' });
      const result = resolveSlot(el, 'img', 'w-full h-full rounded-full', {
        loading: 'lazy',
        alt: '',
      });
      expect(result!.Component).toBe('img');
      expect(result!.props.src).toBe('a.png');
      expect(result!.props.alt).toBe('A');
      expect(result!.props.loading).toBe('lazy');
      expect(result!.props.className).toBe('w-full h-full rounded-sm');
      expect(result!.children).toBeUndefined();
    });

    it('returns null and warns for a primitive with a void default tag', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(resolveSlot('a.png', 'img')).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/^\[WaveUI\] .*<img>/);
    });

    it('returns null and warns for an iterable with a void default tag', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(resolveSlot(['a'], 'input')).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/^\[WaveUI\] .*<input>/);
    });

    it('drops children of a void slot object and warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = resolveSlot({ src: 'a.png', alt: 'A', children: 'oops' }, 'img');
      expect(result!.Component).toBe('img');
      expect(result!.children).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['false', false],
      ['true', true],
      ['an empty string', ''],
      ['null', null],
    ])(
      'drops `children: %s` of a void slot object without a warning (React renders nothing for it)',
      (_label, children) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = resolveSlot({ src: 'a.png', alt: 'A', children }, 'img');
        expect(result!.Component).toBe('img');
        expect(result!.children).toBeUndefined();
        // Same for an object slot rendered `as` a void element from a non-void default.
        const asHr = resolveSlot({ as: 'hr', title: 'Divider', children }, 'span');
        expect(asHr!.Component).toBe('hr');
        expect(asHr!.children).toBeUndefined();
        expect(warn).not.toHaveBeenCalled();
      },
    );

    it('still warns for void slot object children that would render (0)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(resolveSlot({ src: 'a.png', alt: 'A', children: 0 }, 'img')!.children).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
    });

    // Collections React renders nothing for: every item (at any depth) is null, a boolean or ''.
    const emptyCollections: Array<[label: string, make: () => Iterable<React.ReactNode>]> = [
      ['[]', () => []],
      ['[null]', () => [null]],
      ['[false]', () => [false]],
      ["[undefined, true, '']", () => [undefined, true, '']],
      ["[null, [false, ['']]]", () => [null, [false, ['']]]],
      ['a Set of null', () => new Set([null])],
      [
        'a generator of null/false',
        () =>
          (function* () {
            yield null;
            yield false;
          })(),
      ],
    ];

    it.each(emptyCollections)(
      'drops `children: %s` of a void slot object without a warning',
      (_label, make) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = resolveSlot({ src: 'a.png', alt: 'A', children: make() }, 'img');
        expect(result!.Component).toBe('img');
        expect(result!.children).toBeUndefined();
        const asHr = resolveSlot({ as: 'hr', title: 'Divider', children: make() }, 'span');
        expect(asHr!.Component).toBe('hr');
        expect(asHr!.children).toBeUndefined();
        expect(warn).not.toHaveBeenCalled();
      },
    );

    it.each(emptyCollections)(
      'returns null without a warning for a `%s` slot with a void default tag',
      (_label, make) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(resolveSlot(make(), 'img')).toBeNull();
        expect(warn).not.toHaveBeenCalled();
      },
    );

    it.each<[label: string, make: () => Iterable<React.ReactNode>]>([
      ["[null, 'x']", () => [null, 'x']],
      ['[[0]]', () => [[0]]],
      ['[<b />]', () => [React.createElement('b', { key: 'b' })]],
      ["a Set with 'x'", () => new Set([null, 'x'])],
      [
        "a generator yielding 'x'",
        () =>
          (function* () {
            yield false;
            yield 'x';
          })(),
      ],
    ])('still warns for void slot object children `%s` (an item would render)', (_label, make) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(
        resolveSlot({ src: 'a.png', alt: 'A', children: make() }, 'img')!.children,
      ).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/^\[WaveUI\] .*<img> cannot have children/);
      __resetWarnings();
      expect(resolveSlot(make(), 'img')).toBeNull();
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn.mock.calls[1][0]).toMatch(
        /^\[WaveUI\] Slot content cannot be rendered inside <img>/,
      );
    });

    it('does not loop on a self-containing array', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const cyclic: unknown[] = [null];
      cyclic.push(cyclic);
      expect(
        resolveSlot({ src: 'a.png', alt: 'A', children: cyclic as React.ReactNode }, 'img')!
          .children,
      ).toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
    });

    it('returns null without a warning for an empty-string slot with a void default tag', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(resolveSlot('', 'img')).toBeNull();
      expect(warn).not.toHaveBeenCalled();
    });

    it('keeps object slots with src/alt (typed, no cast)', () => {
      const result = resolveSlot({ src: 'a.png', alt: 'A' }, 'img', 'object-cover');
      expect(result).toEqual({
        Component: 'img',
        props: { src: 'a.png', alt: 'A', className: 'object-cover' },
        children: undefined,
      });
    });

    it('returns null and warns for a Fragment element slot (a Fragment cannot take the element props)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fragment = React.createElement(
        React.Fragment,
        null,
        React.createElement('img', { src: 'a.png', alt: 'A' }),
      );
      expect(resolveSlot(fragment, 'img', 'w-full')).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/^\[WaveUI\] .*Fragment.*<img>/);
    });
  });

  describe('className is left out when there are no classes (data-display#3)', () => {
    it('for a slot object without classes', () => {
      expect(resolveSlot({ title: 't', children: 'x' }, 'span')!.props.className).toBeUndefined();
      expect(resolveSlot({ className: '', children: 'x' }, 'span', '')!.props.className).toBe(
        undefined,
      );
    });

    it('for a void ReactElement slot without classes', () => {
      const el = React.createElement('img', { src: 'a.png', alt: 'A' });
      expect(resolveSlot(el, 'img')!.props.className).toBeUndefined();
    });

    it('for shorthand content with an empty base', () => {
      expect(resolveSlot('x', 'span', '')!.props.className).toBeUndefined();
    });

    it('still lets the merged className replace a defaultProps className', () => {
      expect(
        resolveSlot({ children: 'x' }, 'span', undefined, { className: 'ignored' })!.props
          .className,
      ).toBeUndefined();
    });
  });

  it('keeps the public ResolvedSlot shape { Component, props, children } (table-core#33)', () => {
    const result = resolveSlot({ as: 'em', children: 'x', title: 't' }, 'span', 'base');
    expect(Object.keys(result!).sort()).toEqual(['Component', 'children', 'props']);
    expectTypeOf(result).toEqualTypeOf<ResolvedSlot | null>();
    expectTypeOf<Types.ResolvedSlot>().toEqualTypeOf<ResolvedSlot>();
  });
});

describe('renderSlot', () => {
  it('returns null for null/undefined/false/true', () => {
    expect(renderSlot(null)).toBeNull();
    expect(renderSlot(undefined)).toBeNull();
    expect(renderSlot(false)).toBeNull();
    expect(renderSlot(true)).toBeNull();
  });

  it('renders ReactNode shorthand', () => {
    const element = renderSlot('hello', 'span');
    const { container } = render(element!);
    expect(container.querySelector('span')).toHaveTextContent('hello');
  });

  it('renders SlotObject with custom as', () => {
    const element = renderSlot({ as: 'strong', children: 'bold' });
    const { container } = render(element!);
    expect(container.querySelector('strong')).toHaveTextContent('bold');
  });

  it('renders SlotObject with baseClassName', () => {
    const element = renderSlot({ children: 'x', className: 'custom' }, 'span', 'base');
    const { container } = render(element!);
    const span = container.querySelector('span');
    expect(span).toHaveClass('base', 'custom');
  });

  it('lets the slot className win over a conflicting baseClassName (table-core#27)', () => {
    const { container } = render(renderSlot({ children: 'x', className: 'px-2' }, 'span', 'px-4')!);
    expect(container.querySelector('span')!.className).toBe('px-2');
  });

  it('renders defaultProps so icon slots are hidden from the accessible name (button-provider#21)', () => {
    render(
      React.createElement(
        'button',
        { type: 'button' },
        renderSlot('★', 'span', 'shrink-0', { 'aria-hidden': true }),
        'Favourite',
      ),
    );
    expect(screen.getByRole('button', { name: 'Favourite' })).toBeInTheDocument();
    expect(screen.getByText('★')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders an element slot inside the default tag with defaultProps on the wrapper', () => {
    const icon = React.createElement('svg', { 'data-testid': 'icon' });
    const { container } = render(renderSlot(icon, 'span', 'shrink-0', { 'aria-hidden': true })!);
    const wrapper = container.firstElementChild!;
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    expect(wrapper).toHaveClass('shrink-0');
    expect(screen.getByTestId('icon').parentElement).toBe(wrapper);
  });

  it('renders a Set slot as children (table-core#18)', () => {
    const { container } = render(renderSlot(new Set(['a', 'b']), 'span')!);
    expect(container.querySelector('span')).toHaveTextContent('ab');
  });

  it('renders a generator slot as children without a React iterator warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    function* parts() {
      yield 'one';
      yield 'two';
    }
    const { container } = render(
      React.createElement(React.StrictMode, null, renderSlot(parts(), 'span')),
    );
    expect(container.querySelector('span')).toHaveTextContent('onetwo');
    expect(error).not.toHaveBeenCalled();
  });

  it('renders an array slot as children', () => {
    const { container } = render(renderSlot(['$', 5], 'span')!);
    expect(container.querySelector('span')).toHaveTextContent('$5');
  });

  describe('void default tags (data-display#3)', () => {
    it('renders an <img> element slot without nesting (className merged)', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { container } = render(
        renderSlot(
          React.createElement('img', { src: 'a.png', alt: 'Ada', className: 'rounded-sm' }),
          'img',
          'w-full rounded-full',
        )!,
      );
      const img = screen.getByRole('img', { name: 'Ada' });
      expect(img).toHaveAttribute('src', 'a.png');
      expect(img.className).toBe('w-full rounded-sm');
      expect(container.querySelectorAll('img')).toHaveLength(1);
      expect(error).not.toHaveBeenCalled();
    });

    it('renders an object slot with src/alt', () => {
      render(renderSlot<'img'>({ src: 'b.png', alt: 'Bo' }, 'img', 'object-cover')!);
      const img = screen.getByRole('img', { name: 'Bo' });
      expect(img).toHaveAttribute('src', 'b.png');
      expect(img).toHaveClass('object-cover');
    });

    it('renders a void object slot with a conditional `children: false` without warnings or React errors', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const showCaption = false;
      render(
        renderSlot<'img'>({ src: 'c.png', alt: 'Cy', children: showCaption && 'caption' }, 'img')!,
      );
      expect(screen.getByRole('img', { name: 'Cy' })).toHaveAttribute('src', 'c.png');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('renders a void object slot with mapped-to-nothing `children: [null, false]` without warnings or React errors', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const captions: string[] = [];
      render(
        renderSlot<'img'>(
          { src: 'd.png', alt: 'Di', children: [null, captions.length > 0 && captions[0]] },
          'img',
        )!,
      );
      expect(screen.getByRole('img', { name: 'Di' })).toHaveAttribute('src', 'd.png');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('renders nothing (and does not throw) for a string with a void default tag', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(renderSlot('a.png', 'img')).toBeNull();
    });

    it('forwards the element slot ref', () => {
      const ref = React.createRef<HTMLImageElement>();
      render(renderSlot(React.createElement('img', { ref, alt: 'R', src: 'r.png' }), 'img')!);
      expect(ref.current).toBeInstanceOf(HTMLImageElement);
    });

    it('renders no empty class attribute for an element slot without classes', () => {
      render(renderSlot(React.createElement('img', { src: 'a.png', alt: 'A' }), 'img')!);
      expect(screen.getByRole('img', { name: 'A' })).not.toHaveAttribute('class');
    });

    it('renders nothing for a Fragment slot, without a React Fragment-prop error', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fragment = React.createElement(
        React.Fragment,
        null,
        React.createElement('img', { src: 'a.png', alt: 'A' }),
      );
      const { container } = render(
        React.createElement('div', null, renderSlot(fragment, 'img', 'w-full')),
      );
      expect(container.querySelector('img')).toBeNull();
      expect(error).not.toHaveBeenCalled();
    });
  });

  it('renders no empty class attribute for a slot object without classes', () => {
    const { container } = render(renderSlot({ title: 'Tip', children: 'x' }, 'span')!);
    expect(container.querySelector('span')).not.toHaveAttribute('class');
  });
});

describe('Slot types (table-core#18)', () => {
  it('SlotObject accepts the default element props', () => {
    expectTypeOf<{ src: string; alt: string }>().toMatchTypeOf<SlotObject<'img'>>();
    expectTypeOf<{ 'aria-label': string; onClick: () => void }>().toMatchTypeOf<
      SlotObject<'span'>
    >();
    expectTypeOf<{ 'data-testid': string }>().toMatchTypeOf<SlotObject<'span'>>();
  });

  it('`as` can name a different element than the default', () => {
    const slot: Slot<'span'> = { as: 'div', className: 'x' };
    expect(slot).toBeTruthy();
    expectTypeOf<{ as: 'div' }>().toMatchTypeOf<Slot<'span'>>();
  });

  it('accepts iterables of nodes and booleans', () => {
    const fromArray: Slot = ['$', React.createElement('b', { key: 'b' })];
    const fromSet: Slot = new Set(['a']);
    const truthy: Slot = true;
    expect([fromArray, fromSet, truthy]).toHaveLength(3);
    expectTypeOf<Iterable<React.ReactNode>>().toMatchTypeOf<Slot>();
    expectTypeOf<bigint>().toMatchTypeOf<Slot>();
  });

  it('rejects props that the default element does not have', () => {
    // @ts-expect-error — `src` is not a <span> attribute
    const bad: Slot<'span'> = { src: 'x.png' };
    // @ts-expect-error — unknown attribute on the object form
    const bad2: SlotObject<'img'> = { notAnAttribute: true };
    expect([bad, bad2]).toHaveLength(2);
  });

  it("accepts the dismiss-slot union `Slot<'span'> | SlotObject<'button'>` in renderSlot", () => {
    // A declared `const x: Union = { … }` would be narrowed to `SlotObject<'button'>` by the
    // assignment; a value returned from a function keeps the full union, as a prop does.
    const getDismiss = (): Slot<'span'> | SlotObject<'button'> => ({
      type: 'button',
      disabled: true,
    });
    const dismiss = getDismiss();
    expectTypeOf(dismiss).toEqualTypeOf<Slot<'span'> | SlotObject<'button'>>();
    expectTypeOf<Slot<'span'> | SlotObject<'button'>>().toMatchTypeOf<
      Parameters<typeof renderSlot<'span'>>[0]
    >();
    expectTypeOf<Slot<'span'> | SlotObject<'button'>>().toMatchTypeOf<
      Parameters<typeof resolveSlot<'span'>>[0]
    >();
    const node = renderSlot(dismiss, 'span');
    expect(node).not.toBeNull();
    expect(resolveSlot(dismiss, 'span')!.props).toMatchObject({ type: 'button', disabled: true });
  });

  it('re-exports the slot types from types.ts', () => {
    expectTypeOf<Types.Slot<'img'>>().toEqualTypeOf<Slot<'img'>>();
    expectTypeOf<Types.SlotObject<'img'>>().toEqualTypeOf<SlotObject<'img'>>();
  });
});
