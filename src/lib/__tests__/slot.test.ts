import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  materialiseSlotContent,
  resolveSlot,
  resolveWiredSlot,
  renderSlot,
  slotRendersContent,
  slotWrapsDefaultContent,
  VOID_ELEMENTS,
} from '../slot';
import type { ResolvedSlot, Slot, SlotObject, SlotRenderFunction, SlotRenderProps } from '../slot';
import type * as Types from '../types';
import { __resetWarnings } from '../dev';
import { asClientReference } from '../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  __resetWarnings();
});

const IMG_CHILDREN_IGNORED =
  '[WaveUI] A slot rendered as <img> cannot have children; its `children` were ignored.';
const IMG_CONTENT_NOT_RENDERED =
  '[WaveUI] Slot content cannot be rendered inside <img> (a void element). Pass an element or an object slot instead; the slot was not rendered.';
const IMG_FRAGMENT_NOT_RENDERED =
  "[WaveUI] A Fragment cannot stand in for <img> (a void element): it cannot take the slot's className or attributes. Pass the element itself or an object slot instead; the slot was not rendered.";

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

    it('materialises a generator given as slot-object children, so a check does not empty it', () => {
      function* items() {
        yield 'x';
        yield 'y';
      }
      const slot = { className: 'px-1', children: items() };
      expect(slotRendersContent(slot.children)).toBe(true);
      expect(resolveSlot(slot, 'span')!.children).toEqual(['x', 'y']);
      render(renderSlot(slot, 'span')!);
      expect(screen.getByText('xy')).toHaveClass('px-1');
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
      expect(warn.mock.calls).toEqual([[IMG_CONTENT_NOT_RENDERED]]);
    });

    it('returns null and warns for an iterable with a void default tag', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(resolveSlot(['a'], 'input')).toBeNull();
      expect(warn.mock.calls).toEqual([[IMG_CONTENT_NOT_RENDERED.replace('<img>', '<input>')]]);
    });

    it('drops children of a void slot object and warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = resolveSlot({ src: 'a.png', alt: 'A', children: 'oops' }, 'img');
      expect(result!.Component).toBe('img');
      expect(result!.children).toBeUndefined();
      expect(warn.mock.calls).toEqual([[IMG_CHILDREN_IGNORED]]);
    });

    it.each([
      ['false', false],
      ['true', true],
      ['an empty string', ''],
      ['null', null],
    ])(
      'drops `children: %s` of a void slot object without a warning (React renders nothing for it)',
      (_label, children) => {
        const warn = vi.spyOn(console, 'warn');
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
      expect(warn.mock.calls).toEqual([[IMG_CHILDREN_IGNORED]]);
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
        const warn = vi.spyOn(console, 'warn');
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
        const warn = vi.spyOn(console, 'warn');
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
      expect(warn.mock.calls).toEqual([[IMG_CHILDREN_IGNORED]]);
      __resetWarnings();
      expect(resolveSlot(make(), 'img')).toBeNull();
      expect(warn.mock.calls).toEqual([[IMG_CHILDREN_IGNORED], [IMG_CONTENT_NOT_RENDERED]]);
    });

    it('does not loop on a self-containing array', () => {
      const warn = vi.spyOn(console, 'warn');
      const cyclic: unknown[] = [null];
      cyclic.push(cyclic);
      expect(
        resolveSlot({ src: 'a.png', alt: 'A', children: cyclic as React.ReactNode }, 'img')!
          .children,
      ).toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
    });

    it('returns null without a warning for an empty-string slot with a void default tag', () => {
      const warn = vi.spyOn(console, 'warn');
      expect(resolveSlot('', 'img')).toBeNull();
      expect(warn).not.toHaveBeenCalled();
    });

    it.each<[label: string, make: () => React.ReactElement]>([
      ['<></>', () => React.createElement(React.Fragment)],
      ['<>{null}{false}</>', () => React.createElement(React.Fragment, null, null, false)],
      ["<>{['']}</>", () => React.createElement(React.Fragment, null, [''])],
    ])(
      'returns null without a warning for an empty Fragment slot `%s` with a void default tag',
      (_label, make) => {
        const warn = vi.spyOn(console, 'warn');
        expect(resolveSlot(make(), 'img')).toBeNull();
        expect(resolveSlot(make(), 'input', 'w-full')).toBeNull();
        expect(warn).not.toHaveBeenCalled();
      },
    );

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
      expect(warn.mock.calls).toEqual([[IMG_FRAGMENT_NOT_RENDERED]]);
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
    const error = vi.spyOn(console, 'error');
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
      const error = vi.spyOn(console, 'error');
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
      const warn = vi.spyOn(console, 'warn');
      const error = vi.spyOn(console, 'error');
      const showCaption = false;
      render(
        renderSlot<'img'>({ src: 'c.png', alt: 'Cy', children: showCaption && 'caption' }, 'img')!,
      );
      expect(screen.getByRole('img', { name: 'Cy' })).toHaveAttribute('src', 'c.png');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('renders a void object slot with mapped-to-nothing `children: [null, false]` without warnings or React errors', () => {
      const warn = vi.spyOn(console, 'warn');
      const error = vi.spyOn(console, 'error');
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
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(renderSlot('a.png', 'img')).toBeNull();
      expect(warn.mock.calls).toEqual([[IMG_CONTENT_NOT_RENDERED]]);
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
      const error = vi.spyOn(console, 'error');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
      expect(warn.mock.calls).toEqual([[IMG_FRAGMENT_NOT_RENDERED]]);
    });
  });

  it('renders no empty class attribute for a slot object without classes', () => {
    const { container } = render(renderSlot({ title: 'Tip', children: 'x' }, 'span')!);
    expect(container.querySelector('span')).not.toHaveAttribute('class');
  });
});

describe('slotRendersContent (data-display#31)', () => {
  it.each<[label: string, make: () => unknown]>([
    ['null', () => null],
    ['undefined', () => undefined],
    ['false', () => false],
    ['true', () => true],
    ["''", () => ''],
    ['[]', () => []],
    ["[null, false, '', [undefined]]", () => [null, false, '', [undefined]]],
    ["a Set of null and ''", () => new Set([null, ''])],
    [
      "a generator of null and ''",
      () =>
        (function* () {
          yield null;
          yield '';
        })(),
    ],
    ['an empty Fragment element', () => React.createElement(React.Fragment)],
    [
      "a Fragment of null, '' and an empty Fragment",
      () =>
        React.createElement(React.Fragment, null, null, '', React.createElement(React.Fragment)),
    ],
    ['[<></>, null]', () => [React.createElement(React.Fragment), null]],
    [
      'a Fragment given as a client reference (a lazy type)',
      () => React.createElement(asClientReference(React.Fragment), null, false),
    ],
  ])('is false for %s (React renders nothing for it)', (_label, make) => {
    expect(slotRendersContent(make())).toBe(false);
  });

  it.each<[label: string, make: () => unknown]>([
    ["'x'", () => 'x'],
    ['0', () => 0],
    ['0n', () => BigInt(0)],
    ["[null, 'x']", () => [null, 'x']],
    ['<b />', () => React.createElement('b')],
    ['a Fragment of 0', () => React.createElement(React.Fragment, null, 0)],
    [
      'a Fragment around an element, in an array',
      () => [null, React.createElement(React.Fragment, null, React.createElement('b'))],
    ],
    ["a Set with 'x'", () => new Set([null, 'x'])],
    ['a slot object without children (it renders its element)', () => ({ className: 'px-1' })],
  ])('is true for %s', (_label, make) => {
    expect(slotRendersContent(make())).toBe(true);
  });

  it('does not consume a generator: renderSlot still renders its items afterwards', () => {
    function* parts() {
      yield null;
      yield 'one';
      yield 'two';
    }
    const gen = parts();
    expect(slotRendersContent(gen)).toBe(true);
    expect(slotRendersContent(gen)).toBe(true);
    const { container } = render(renderSlot(gen, 'span')!);
    expect(container.querySelector('span')).toHaveTextContent('onetwo');
  });

  it('does not loop on a self-containing array', () => {
    const cyclic: unknown[] = [null];
    cyclic.push(cyclic);
    expect(slotRendersContent(cyclic)).toBe(false);
  });

  it('counts a generator inside an array or a Fragment as content without reading it', () => {
    let reads = 0;
    function* parts() {
      reads += 1;
      yield 'one';
    }
    const inArray = [null, parts()];
    const inFragment = React.createElement(React.Fragment, null, parts());
    expect(slotRendersContent(inArray)).toBe(true);
    expect(slotRendersContent(inFragment)).toBe(true);
    // Neither generator was started: React still renders their items.
    expect(reads).toBe(0);
  });

  it('does not warn', () => {
    const warn = vi.spyOn(console, 'warn');
    slotRendersContent([null]);
    slotRendersContent('x');
    expect(warn).not.toHaveBeenCalled();
  });

  it('lets a consumer treat an icon collection that renders nothing as no icon', () => {
    // The Avatar pattern: `icon && slotRendersContent(icon)` decides between the icon and a fallback.
    const pick = (icon: Slot) =>
      icon && slotRendersContent(icon)
        ? renderSlot(icon, 'span', undefined, { 'aria-hidden': true })
        : 'JD';
    expect(pick([null, ''])).toBe('JD');
    expect(pick(new Set<React.ReactNode>())).toBe('JD');
    expect(pick(0)).toBe('JD');
    const { container } = render(React.createElement('div', null, pick(['*'])));
    expect(container.querySelector('span[aria-hidden="true"]')).toHaveTextContent('*');
  });
});

describe('materialiseSlotContent', () => {
  function* parts() {
    yield 'one';
    yield 'two';
  }

  it('gives the items of a generator that slotRendersContent read, for a caller rendering it', () => {
    const gen = parts();
    expect(slotRendersContent(gen)).toBe(true);
    const error = vi.spyOn(console, 'error');
    render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement('span', { 'data-testid': 'own' }, materialiseSlotContent(gen)),
      ),
    );
    expect(screen.getByTestId('own')).toHaveTextContent('onetwo');
    // React never enumerated the generator itself (it warns when it does).
    expect(error).not.toHaveBeenCalled();
  });

  it('gives the same items every time (a second render, StrictMode)', () => {
    const gen = parts();
    const first = materialiseSlotContent(gen);
    expect(first).toEqual(['one', 'two']);
    expect(materialiseSlotContent(gen)).toBe(first);
    expect(slotRendersContent(gen)).toBe(true);
  });

  it('returns every other value as given', () => {
    const list = ['a', 'b'];
    const set = new Set(['a']);
    const element = React.createElement('b');
    const fragment = React.createElement(React.Fragment, null, 'x');
    for (const value of [list, set, element, fragment, 'text', 0, null, undefined, false]) {
      expect(materialiseSlotContent(value)).toBe(value);
    }
  });
});

describe('slotWrapsDefaultContent (the default icon of a dismiss slot object)', () => {
  const markup = { __html: '<svg></svg>' };
  function DrawnIcon() {
    return null;
  }

  it.each<[label: string, type: unknown, props: Record<string, unknown>]>([
    ['a span without children', 'span', {}],
    ['a span whose children render nothing', 'span', { children: [null, ''] }],
    [
      'a span whose children are an empty Fragment',
      'span',
      { children: React.createElement(React.Fragment) },
    ],
    ['an intrinsic tag other than span', 'i', { className: 'text-error' }],
  ])('is true for %s (it styles the default icon)', (_label, type, props) => {
    expect(slotWrapsDefaultContent(type, props)).toBe(true);
  });

  it.each<[label: string, type: unknown, props: Record<string, unknown>]>([
    ['a span with children that render something', 'span', { children: 'x' }],
    ['a span with children of 0', 'span', { children: 0 }],
    [
      'a span with dangerouslySetInnerHTML (markup of its own)',
      'span',
      { dangerouslySetInnerHTML: markup },
    ],
    ['a void tag (img)', 'img', { src: 'close.svg', alt: '' }],
    ['a void tag (input)', 'input', {}],
    ['a component (it draws its own glyph)', DrawnIcon, {}],
  ])('is false for %s (it is the content itself)', (_label, type, props) => {
    expect(slotWrapsDefaultContent(type, props)).toBe(false);
  });

  it('does not consume a generator given as children', () => {
    function* nothing(): Generator<React.ReactNode> {
      yield null;
    }
    const gen = nothing();
    expect(slotWrapsDefaultContent('span', { children: gen })).toBe(true);
    expect(materialiseSlotContent(gen)).toEqual([null]);
  });
});

describe('render-function children (P13-01, spec R8)', () => {
  /** A render function that renders the element it receives, with a test id and a star. */
  const renderStar = () =>
    vi.fn((Component: React.ElementType, props: object) =>
      React.createElement(Component, { ...props, 'data-testid': 'own' }, '★'),
    );

  function Glyph(props: React.HTMLAttributes<HTMLElement>) {
    return React.createElement('b', props);
  }

  it('calls the function with the element type and the merged props, and renders its result in place of the element', () => {
    const ref = React.createRef<HTMLSpanElement>();
    const renderFn = renderStar();
    const { container } = render(
      renderSlot(
        { className: 'mine', title: 'Star', 'data-part': 'icon', ref, children: renderFn },
        'span',
        'base',
        { 'aria-hidden': true },
      )!,
    );
    expect(renderFn).toHaveBeenCalledWith('span', {
      'aria-hidden': true,
      title: 'Star',
      'data-part': 'icon',
      ref,
      className: 'base mine',
    });
    const own = screen.getByTestId('own');
    // No element of the slot's own around the result: the function's element is the slot.
    expect(container.firstElementChild).toBe(own);
    expect(own.tagName).toBe('SPAN');
    expect(own.className).toBe('base mine');
    expect(own).toHaveAttribute('aria-hidden', 'true');
    expect(own).toHaveAttribute('title', 'Star');
    expect(own).toHaveAttribute('data-part', 'icon');
    expect(own).toHaveTextContent('★');
    expect(ref.current).toBe(own);
  });

  it('passes the element type that `as` names: a tag or a component', () => {
    const tag = renderStar();
    render(renderSlot({ as: 'i', children: tag }, 'span')!);
    expect(tag).toHaveBeenCalledWith('i', {});
    expect(screen.getByTestId('own').tagName).toBe('I');

    const component = renderStar();
    render(renderSlot({ as: Glyph, className: 'x', children: component }, 'span', 'base')!);
    expect(component).toHaveBeenCalledWith(Glyph, { className: 'base x' });
  });

  it('never passes `as` or the function itself in the props', () => {
    const renderFn = renderStar();
    render(renderSlot({ as: 'em', children: renderFn }, 'span')!);
    const [, props] = renderFn.mock.calls[0];
    expect(props).not.toHaveProperty('as');
    expect(props).not.toHaveProperty('children');
    expect(Object.values(props)).not.toContain(renderFn);
  });

  it('renders whatever the function returns: text, a list, or nothing', () => {
    const { container, rerender } = render(
      React.createElement('div', null, renderSlot({ children: () => 'text' }, 'span', 'base')),
    );
    expect(container.firstElementChild!.innerHTML).toBe('text');
    rerender(
      React.createElement(
        'div',
        null,
        renderSlot(
          {
            children: () => [
              React.createElement('b', { key: 'b' }, 'B'),
              React.createElement('i', { key: 'i' }, 'I'),
            ],
          },
          'span',
        ),
      ),
    );
    expect(container.firstElementChild!.innerHTML).toBe('<b>B</b><i>I</i>');
    rerender(
      React.createElement('div', null, renderSlot({ children: () => null }, 'span', 'base')),
    );
    expect(container.firstElementChild!.innerHTML).toBe('');
  });

  it('resolveSlot gives an element type that hands the function the props and children its renderer adds', () => {
    const renderFn = renderStar();
    const onClick = vi.fn();
    const resolved = resolveSlot({ className: 'mine', children: renderFn }, 'span', 'base')!;
    expect(resolved.children).toBeUndefined();
    // A component that renders the resolved slot itself, adding its wiring and its default content.
    render(
      React.createElement(
        resolved.Component,
        { ...resolved.props, 'aria-hidden': 'true', onClick },
        'default',
      ),
    );
    expect(renderFn).toHaveBeenCalledWith('span', {
      className: 'base mine',
      'aria-hidden': 'true',
      onClick,
      children: 'default',
    });
    // The star replaced the default content: the function rendered its own children.
    expect(screen.getByTestId('own')).toHaveTextContent('★');
  });

  it('renders a void element through the function without the void-children warning', () => {
    const warn = vi.spyOn(console, 'warn');
    const renderFn = vi.fn((Component: React.ElementType, props: object) =>
      React.createElement(Component, props),
    );
    render(renderSlot<'img'>({ src: 'a.png', alt: 'Ada', children: renderFn }, 'img', 'w-full')!);
    expect(renderFn).toHaveBeenCalledWith('img', { src: 'a.png', alt: 'Ada', className: 'w-full' });
    expect(screen.getByRole('img', { name: 'Ada' })).toHaveClass('w-full');
    expect(warn).not.toHaveBeenCalled();
  });

  it('renders one element in StrictMode (the function may be called more than once)', () => {
    const renderFn = renderStar();
    const { container } = render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement('div', null, renderSlot({ children: renderFn }, 'span')),
      ),
    );
    expect(container.firstElementChild!.children).toHaveLength(1);
    expect(renderFn.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const call of renderFn.mock.calls) expect(call).toEqual(['span', {}]);
  });

  describe('slotRendersContent of a render function', () => {
    it.each<[label: string, render: () => React.ReactNode]>([
      ['null', () => null],
      ['undefined', () => undefined],
      ['false', () => false],
      ["''", () => ''],
      ['[]', () => []],
      ['an empty Fragment', () => React.createElement(React.Fragment)],
    ])('is false for a function that returns %s', (_label, renderFn) => {
      expect(slotRendersContent({ children: renderFn })).toBe(false);
    });

    it.each<[label: string, render: SlotRenderFunction<object>]>([
      ["'x'", () => 'x'],
      ['0', () => 0],
      ['the element it receives', (Component, props) => React.createElement(Component, props)],
    ])('is true for a function that returns %s', (_label, renderFn) => {
      expect(slotRendersContent({ children: renderFn })).toBe(true);
    });

    it('calls the function with the object’s `as` (else a span) and its other attributes', () => {
      const renderFn = vi.fn(() => null);
      slotRendersContent({ as: 'i', title: 't', children: renderFn });
      slotRendersContent({ 'data-x': '1', children: renderFn });
      expect(renderFn.mock.calls).toEqual([
        ['i', { title: 't' }],
        ['span', { 'data-x': '1' }],
      ]);
    });

    it('calls no function given bare or nested in content (not a slot object’s children)', () => {
      const renderFn = vi.fn(() => null);
      expect(slotRendersContent(renderFn)).toBe(true);
      expect(slotRendersContent([null, renderFn])).toBe(true);
      expect(slotRendersContent({ title: 't', children: [renderFn] })).toBe(true);
      expect(renderFn).not.toHaveBeenCalled();
    });

    it('calls no `children` function of an object that is no slot object (a portal, a class instance)', () => {
      const renderFn = vi.fn(() => null);
      class TreeNode {
        children = renderFn;
      }
      expect(slotRendersContent({ $$typeof: Symbol.for('react.portal'), children: renderFn })).toBe(
        true,
      );
      expect(slotRendersContent(new TreeNode())).toBe(true);
      expect(renderFn).not.toHaveBeenCalled();
    });
  });

  describe('slotWrapsDefaultContent of a render function', () => {
    it.each<[label: string, slot: SlotObject<'span'>]>([
      ['a span', { className: 'x', children: () => null }],
      ['another intrinsic tag that renders content', { as: 'i', children: () => 'x' }],
    ])(
      'is true for the element resolved from %s: the function receives the default content',
      (_label, slot) => {
        const resolved = resolveSlot(slot, 'span')!;
        expect(slotWrapsDefaultContent(resolved.Component, resolved.props)).toBe(true);
        // As a renderer passes them: the resolved props with the slot's children.
        expect(
          slotWrapsDefaultContent(resolved.Component, {
            ...resolved.props,
            children: resolved.children,
          }),
        ).toBe(true);
      },
    );

    it.each<[label: string, slot: SlotObject<'span'>]>([
      ['a void tag (img)', { as: 'img', children: () => null }],
      ['a component (it draws its own glyph)', { as: Glyph, children: () => null }],
    ])('is false for the element resolved from %s', (_label, slot) => {
      const resolved = resolveSlot(slot, 'span')!;
      expect(slotWrapsDefaultContent(resolved.Component, resolved.props)).toBe(false);
    });

    it('counts unresolved function children as content without calling them', () => {
      const renderFn = vi.fn(() => null);
      expect(slotWrapsDefaultContent('span', { children: renderFn })).toBe(false);
      expect(renderFn).not.toHaveBeenCalled();
    });
  });

  describe('resolveWiredSlot (the dismiss, clear and close slots)', () => {
    const isButton = (type: unknown) => type === 'button' || type === Glyph;
    const noop = () => {};

    it('returns a slot without a render function, and null, as given', () => {
      const resolved = resolveSlot({ as: 'button', className: 'x', children: 'X' }, 'span');
      expect(resolveWiredSlot(resolved, isButton)).toBe(resolved);
      expect(resolveWiredSlot(null, isButton)).toBeNull();
    });

    it('keeps the element of a function that renders content and names no button', () => {
      const resolved = resolveSlot({ className: 'x', children: renderStar() }, 'span');
      expect(resolveWiredSlot(resolved, isButton)).toBe(resolved);
    });

    it.each<[label: string, as: React.ElementType]>([
      ['"button"', 'button'],
      ['a button component', Glyph],
    ])(
      'gives an object whose `as` is %s its type, attributes and the function’s content for a span',
      (_label, as) => {
        const renderFn = vi.fn(() => 'content');
        const wired = resolveWiredSlot(
          resolveSlot({ as, onClick: noop, children: renderFn }, 'span'),
          isButton,
        )!;
        expect(wired).toEqual({
          Component: as,
          props: { onClick: noop, className: undefined },
          children: 'content',
        });
        expect(renderFn.mock.calls).toEqual([['span', {}]]);
      },
    );

    it('leaves out a function that renders nothing, keeping the object’s attributes', () => {
      const renderFn = vi.fn(() => null);
      const wired = resolveWiredSlot(
        resolveSlot({ className: 'x', 'data-part': 'p', children: renderFn }, 'span'),
        isButton,
      )!;
      expect(wired).toEqual({
        Component: 'span',
        props: { className: 'x', 'data-part': 'p' },
        children: undefined,
      });
      expect(renderFn.mock.calls).toEqual([['span', { className: 'x', 'data-part': 'p' }]]);
      expect(slotWrapsDefaultContent(wired.Component, wired.props)).toBe(true);
    });
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
    expectTypeOf<readonly React.ReactNode[]>().toMatchTypeOf<Slot>();
    expectTypeOf<bigint>().toMatchTypeOf<Slot>();
  });

  it('accepts any React.ReactNode, promises included', () => {
    expectTypeOf<React.ReactNode>().toMatchTypeOf<Slot>();
    expectTypeOf<React.ReactNode>().toMatchTypeOf<Slot<'img'>>();
    expectTypeOf<Promise<string>>().toMatchTypeOf<Slot>();
    // The usual consumer shape: content typed as ReactNode passed straight to a slot prop.
    interface Action {
      icon: React.ReactNode;
      label: string;
    }
    const action: Action = { icon: '*', label: 'Star' };
    const icon: Slot = action.icon;
    const { container } = render(renderSlot(icon, 'span')!);
    expect(container.querySelector('span')).toHaveTextContent('*');
  });

  it('takes an interface-typed attributes object through a spread', () => {
    const imgProps: React.ImgHTMLAttributes<HTMLImageElement> = { src: 'a.png', alt: 'A' };
    // @ts-expect-error — an interface has no implicit `data-*` index signature
    const direct: Slot<'img'> = imgProps;
    const spread: Slot<'img'> = { ...imgProps };
    expect(resolveSlot(spread, 'img')!.props).toMatchObject({ src: 'a.png', alt: 'A' });
    expect(direct).toBe(imgProps);
  });

  it('rejects props that the default element does not have', () => {
    // @ts-expect-error — `src` is not a <span> attribute
    const bad: Slot<'span'> = { src: 'x.png' };
    // @ts-expect-error — unknown attribute on the object form
    const bad2: SlotObject<'img'> = { notAnAttribute: true };
    expect([bad, bad2]).toHaveLength(2);
  });

  it("accepts a slot union `Slot<'span'> | SlotObject<'button'>` in renderSlot", () => {
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

  it('takes a function annotated with the bare SlotRenderFunction in every slot (P13-01)', () => {
    expectTypeOf<SlotRenderFunction>().toEqualTypeOf<SlotRenderFunction<SlotRenderProps>>();
    expectTypeOf<SlotObject<'span'>['children']>().toEqualTypeOf<
      React.ReactNode | SlotRenderFunction | undefined
    >();
    const reusable: SlotRenderFunction = (Component, props) =>
      React.createElement(Component, props);
    const span: Slot<'span'> = { children: reusable };
    const img: Slot<'img'> = { alt: '', children: reusable };
    const dismiss: Slot<'span'> | SlotObject<'button'> = { children: reusable };
    expect([span, img, dismiss]).toHaveLength(3);
  });

  it('takes a render function as the children of a slot object, typed for any slot element', () => {
    type RenderProps = React.HTMLAttributes<HTMLElement> & {
      [dataAttribute: `data-${string}`]: unknown;
    };
    expectTypeOf<SlotObject<'span'>['children']>().toEqualTypeOf<
      React.ReactNode | SlotRenderFunction<RenderProps> | undefined
    >();
    expectTypeOf<SlotObject<'img'>['children']>().toEqualTypeOf<SlotObject<'span'>['children']>();
    expectTypeOf<SlotRenderFunction<{ as?: string; title?: string }>>().toEqualTypeOf<
      (
        Component: React.ElementType<{ as?: string; title?: string }>,
        props: { title?: string },
      ) => React.ReactNode
    >();
    // The parameters take their types from the slot prop, as an inline arrow function.
    const slot: Slot<'img'> = {
      alt: '',
      children: (Component, props) => {
        expectTypeOf(props.className).toEqualTypeOf<string | undefined>();
        expectTypeOf(props.children).toEqualTypeOf<React.ReactNode>();
        expectTypeOf(props).not.toHaveProperty('as');
        return React.createElement(Component, props);
      },
    };
    // One function fits every member of a slot union (a slot of two element types).
    const getDismiss = (): Slot<'span'> | SlotObject<'button'> => ({
      children: (Component, props) => React.createElement(Component, props),
    });
    // The props spread onto any tag, whatever the slot's element.
    const backdrop: Slot<'div'> = {
      children: (_Component, props) => React.createElement('div', props),
    };
    expect([slot, getDismiss(), backdrop]).toHaveLength(3);
    // A bare function is no slot value.
    // @ts-expect-error — a render function goes in a slot object's `children`
    const bare: Slot<'span'> = () => null;
    expect(bare).toBeTruthy();
  });

  it('re-exports the slot types from types.ts', () => {
    expectTypeOf<Types.Slot<'img'>>().toEqualTypeOf<Slot<'img'>>();
    expectTypeOf<Types.SlotObject<'img'>>().toEqualTypeOf<SlotObject<'img'>>();
  });

  it('re-exports SlotRenderFunction from types.ts (P13-01)', () => {
    expectTypeOf<Types.SlotRenderFunction<object>>().toEqualTypeOf<SlotRenderFunction<object>>();
  });
});
