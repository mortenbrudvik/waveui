import * as React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  getNativeElementProps,
  NATIVE_EVENT_NAMES,
  NATIVE_GLOBAL_PROPS,
  NATIVE_NO_CAPTURE_EVENTS,
  NATIVE_TAG_PROPS,
} from '../nativeProps';

type Tags = keyof React.JSX.IntrinsicElements;
/** The names of a space-separated literal, as a union (the lists are strings to keep them small). */
type Names<S extends string, Found extends string = never> = S extends `${infer H} ${infer T}`
  ? Names<T, Found | H>
  : Found | S;

const names = (list: string) => list.split(' ');

describe('the attribute lists are valid for React (type level)', () => {
  it('names only attributes of the tag, and only events of the DOM attributes', () => {
    // A typo in a list fails the typecheck of the dev program, not a run.
    type Props<E extends Tags> = keyof React.ComponentPropsWithRef<E>;
    expectTypeOf<Names<typeof NATIVE_GLOBAL_PROPS>>().toExtend<Props<'div'>>();
    expectTypeOf<Names<typeof NATIVE_GLOBAL_PROPS>>().toExtend<Props<'span'>>();
    expectTypeOf<Names<(typeof NATIVE_TAG_PROPS)['a']>>().toExtend<Props<'a'>>();
    expectTypeOf<Names<(typeof NATIVE_TAG_PROPS)['button']>>().toExtend<Props<'button'>>();
    expectTypeOf<Names<(typeof NATIVE_TAG_PROPS)['img']>>().toExtend<Props<'img'>>();
    expectTypeOf<Names<(typeof NATIVE_TAG_PROPS)['input']>>().toExtend<Props<'input'>>();
    expectTypeOf<Names<(typeof NATIVE_TAG_PROPS)['label']>>().toExtend<Props<'label'>>();
    expectTypeOf<Names<(typeof NATIVE_TAG_PROPS)['li']>>().toExtend<Props<'li'>>();
    expectTypeOf<Names<(typeof NATIVE_TAG_PROPS)['ol']>>().toExtend<Props<'ol'>>();
    expectTypeOf<Names<(typeof NATIVE_TAG_PROPS)['option']>>().toExtend<Props<'option'>>();
    expectTypeOf<Names<(typeof NATIVE_TAG_PROPS)['select']>>().toExtend<Props<'select'>>();
    expectTypeOf<Names<(typeof NATIVE_TAG_PROPS)['td']>>().toExtend<Props<'td'>>();
    expectTypeOf<Names<(typeof NATIVE_TAG_PROPS)['th']>>().toExtend<Props<'th'>>();
    expectTypeOf<Names<(typeof NATIVE_TAG_PROPS)['textarea']>>().toExtend<Props<'textarea'>>();
    type EventKey = `on${Names<typeof NATIVE_EVENT_NAMES>}`;
    expectTypeOf<EventKey>().toExtend<keyof React.DOMAttributes<Element>>();
    // Every capture handler the helper can produce is a prop of React's DOM attributes.
    type CaptureKey = `on${Exclude<
      Names<typeof NATIVE_EVENT_NAMES>,
      Names<typeof NATIVE_NO_CAPTURE_EVENTS>
    >}Capture`;
    expectTypeOf<CaptureKey>().toExtend<keyof React.DOMAttributes<Element>>();
    expectTypeOf<Names<typeof NATIVE_NO_CAPTURE_EVENTS>>().toExtend<
      Names<typeof NATIVE_EVENT_NAMES>
    >();
  });

  it('gives each tag with extras a list in the table of tags', () => {
    expect(Object.keys(NATIVE_TAG_PROPS).sort()).toEqual(
      [
        'a',
        'button',
        'img',
        'input',
        'label',
        'li',
        'ol',
        'option',
        'select',
        'td',
        'textarea',
        'th',
      ].sort(),
    );
  });
});

describe('getNativeElementProps', () => {
  it('keeps the global attributes, event handlers, data-*, aria-*, and ref of a tag without extras', () => {
    const onClick = () => {};
    const ref = () => {};
    const props = {
      id: 'a',
      className: 'c',
      style: { color: 'red' },
      title: 't',
      lang: 'en',
      dir: 'rtl',
      hidden: true,
      role: 'button',
      tabIndex: 0,
      draggable: true,
      contentEditable: true,
      spellCheck: false,
      translate: 'no',
      accessKey: 'k',
      slot: 's',
      inert: true,
      popover: 'auto',
      autoFocus: true,
      autoCapitalize: 'none',
      inputMode: 'numeric',
      enterKeyHint: 'done',
      nonce: 'n',
      suppressHydrationWarning: true,
      suppressContentEditableWarning: true,
      onClick,
      onKeyDownCapture: onClick,
      onGotPointerCapture: onClick,
      onDragEnterCapture: onClick,
      onDragLeaveCapture: onClick,
      'data-x': '1',
      'aria-label': 'l',
      ref,
    };
    expect(getNativeElementProps('div', props)).toEqual(props);
  });

  it('drops key, which is no prop and makes React warn when spread', () => {
    expect(getNativeElementProps('div', { key: 'k', id: 'a' })).toEqual({ id: 'a' });
  });

  it('ignores inherited properties and keeps the order of the props', () => {
    const inherited = Object.assign(Object.create({ id: 'inherited', title: 't' }), {
      className: 'c',
      'data-b': 1,
      'aria-a': 2,
      lang: 'en',
    });
    const result = getNativeElementProps('div', inherited);
    expect(result).toEqual({ className: 'c', 'data-b': 1, 'aria-a': 2, lang: 'en' });
    expect(Object.keys(result)).toEqual(['className', 'data-b', 'aria-a', 'lang']);
  });

  it('is not changed by own __proto__ or constructor keys and returns a plain object', () => {
    const props = JSON.parse(
      '{"__proto__": {"id": "x", "polluted": true}, "constructor": 1, "id": "a"}',
    );
    expect(Object.keys(props)).toContain('__proto__');
    const result = getNativeElementProps('div', props);
    expect(result).toEqual({ id: 'a' });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(getNativeElementProps('div', props, ['id'])).toEqual({});
  });

  it('matches data-* and aria-* by their hyphenated prefix only', () => {
    expect(
      getNativeElementProps('div', {
        data: 1,
        dataX: 2,
        'data-x': 3,
        aria: 4,
        ariaLabel: 5,
        'aria-label': 6,
      }),
    ).toEqual({ 'data-x': 3, 'aria-label': 6 });
  });

  it('does not throw for a tag name that is a member of Object.prototype', () => {
    const tag = 'constructor' as unknown as 'div';
    expect(getNativeElementProps(tag, { id: 'a', href: '#' })).toEqual({ id: 'a' });
    expect(getNativeElementProps('toString' as unknown as 'div', { id: 'a' })).toEqual({ id: 'a' });
  });

  it('drops the props only a component understands', () => {
    const own = {
      appearance: 'primary',
      slotProps: {},
      onValueChange: () => {},
      onOpenChange: () => {},
      onCheckedChange: () => {},
      children: 'x',
      as: 'b',
      onclick: () => {},
      id: 'kept',
    };
    expect(getNativeElementProps('span', own)).toEqual({ id: 'kept' });
    expect(getNativeElementProps('input', own)).toEqual({ id: 'kept' });
  });

  it('keeps the attributes of an input', () => {
    const props = {
      type: 'number',
      value: 1,
      checked: false,
      placeholder: 'p',
      required: true,
      min: 0,
      max: 9,
      step: 1,
      pattern: '.*',
      form: 'f',
      name: 'n',
      disabled: true,
      readOnly: true,
      autoComplete: 'off',
      maxLength: 4,
      list: 'l',
      onChange: () => {},
    };
    expect(getNativeElementProps('input', props)).toEqual(props);
    expect(getNativeElementProps('span', props)).toEqual({ onChange: props.onChange });
  });

  it('keeps the attributes of a link, a button, an image, a label and the list, form and table tags', () => {
    const link = { href: '#', target: '_blank', rel: 'noopener', download: '' };
    expect(getNativeElementProps('a', link)).toEqual(link);
    const button = {
      type: 'submit',
      disabled: true,
      form: 'f',
      formAction: '/a',
      formEncType: 'text/plain',
      formMethod: 'post',
      formNoValidate: true,
      formTarget: '_self',
      name: 'n',
      value: 'v',
    };
    expect(getNativeElementProps('button', button)).toEqual(button);
    const image = { src: 's', alt: 'a', loading: 'lazy', srcSet: 'x 2x', width: 1, height: 2 };
    expect(getNativeElementProps('img', image)).toEqual(image);
    expect(getNativeElementProps('label', { htmlFor: 'i', form: 'f' })).toEqual({ htmlFor: 'i' });
    expect(getNativeElementProps('li', { value: 2 })).toEqual({ value: 2 });
    expect(getNativeElementProps('ol', { start: 2, reversed: true, type: 'a' })).toEqual({
      start: 2,
      reversed: true,
      type: 'a',
    });
    expect(getNativeElementProps('ul', { start: 2 })).toEqual({});
    expect(
      getNativeElementProps('option', { value: 'v', label: 'l', disabled: true, selected: true }),
    ).toEqual({ value: 'v', label: 'l', disabled: true });
    expect(
      getNativeElementProps('select', { multiple: true, size: 3, name: 'n', required: true }),
    ).toEqual({ multiple: true, size: 3, name: 'n', required: true });
    expect(
      getNativeElementProps('textarea', { rows: 2, cols: 3, wrap: 'hard', placeholder: 'p' }),
    ).toEqual({ rows: 2, cols: 3, wrap: 'hard', placeholder: 'p' });
    const header = { scope: 'col', colSpan: 2, rowSpan: 2, abbr: 'a', headers: 'h' };
    expect(getNativeElementProps('th', header)).toEqual(header);
    const cell = { colSpan: 2, rowSpan: 2, headers: 'h', scope: 'row' };
    expect(getNativeElementProps('td', cell)).toEqual(cell);
    for (const tag of ['table', 'tbody', 'thead', 'tfoot', 'tr'] as const) {
      expect(getNativeElementProps(tag, { colSpan: 2, id: 'x' })).toEqual({ id: 'x' });
    }
  });

  it('gives a tag outside the table the global set', () => {
    const props = {
      id: 'v',
      src: 'x',
      controls: true,
      'data-a': 1,
      'aria-hidden': true,
      onPlay: () => {},
    };
    expect(getNativeElementProps('video', props)).toEqual({
      id: 'v',
      'data-a': 1,
      'aria-hidden': true,
      onPlay: props.onPlay,
    });
  });

  it('drops a capture handler React has no event for', () => {
    const handler = () => {};
    expect(
      getNativeElementProps('div', {
        onMouseEnter: handler,
        onMouseEnterCapture: handler,
        onToggle: handler,
        onToggleCapture: handler,
        onPointerDownCapture: handler,
      }),
    ).toEqual({ onMouseEnter: handler, onToggle: handler, onPointerDownCapture: handler });
  });

  it('removes the excluded names, also data and event names', () => {
    const props = { id: 'a', className: 'b', 'data-x': 1, onClick: () => {}, title: 't' };
    expect(getNativeElementProps('div', props, ['id', 'data-x', 'onClick'])).toEqual({
      className: 'b',
      title: 't',
    });
  });

  it('does not change the props it reads and returns a new object', () => {
    const props = { id: 'a', appearance: 'x' };
    const result = getNativeElementProps('div', props);
    expect(result).not.toBe(props);
    expect(props).toEqual({ id: 'a', appearance: 'x' });
  });

  it('types the result for the element, so a larger props object spreads onto it', () => {
    interface Own {
      id?: string;
      appearance: 'primary' | 'subtle';
      onValueChange: (value: string) => void;
      'data-state'?: string;
    }
    const own: Own = {
      id: 'a',
      appearance: 'subtle',
      onValueChange: () => {},
      'data-state': 'open',
    };
    const spanProps = getNativeElementProps('span', own);
    expectTypeOf(spanProps).toExtend<Partial<React.JSX.IntrinsicElements['span']>>();
    const withData: typeof spanProps = { 'data-anything': 1 };
    expect(withData).toBeDefined();
    // @ts-expect-error a span has no `href`
    const bad: typeof spanProps = { href: '#' };
    expect(bad).toBeDefined();
    const inputProps = getNativeElementProps('input', own);
    expectTypeOf(inputProps.placeholder).toEqualTypeOf<string | undefined>();
    // @ts-expect-error an exclusion names a key of the props
    getNativeElementProps('span', own, ['nope']);
    getNativeElementProps('span', own, ['appearance']);
    const { container } = render(
      <>
        <span {...getNativeElementProps('span', own)} />
        <input {...getNativeElementProps('input', own)} />
      </>,
    );
    expect(container.querySelector('span')).toHaveAttribute('id', 'a');
    expect(container.querySelector('span')).toHaveAttribute('data-state', 'open');
    expect(container.querySelector('span')).not.toHaveAttribute('appearance');
  });
});

/** A plausible value for each attribute whose value is no string. */
const VALUES: Record<string, unknown> = {
  suppressHydrationWarning: true,
  suppressContentEditableWarning: true,
  style: { color: 'red' },
  tabIndex: 0,
  hidden: true,
  draggable: true,
  contentEditable: true,
  spellCheck: true,
  translate: 'no',
  inert: true,
  popover: 'auto',
  role: 'group',
  dir: 'ltr',
  lang: 'en',
  disabled: true,
  required: true,
  readOnly: true,
  multiple: true,
  autoFocus: true,
  checked: true,
  selected: true,
  reversed: true,
  formNoValidate: true,
  formMethod: 'post',
  formEncType: 'text/plain',
  formTarget: '_self',
  popoverTargetAction: 'toggle',
  download: '',
  loading: 'lazy',
  decoding: 'async',
  fetchPriority: 'high',
  crossOrigin: 'anonymous',
  referrerPolicy: 'no-referrer',
  type: 'text',
  wrap: 'soft',
  scope: 'col',
  inputMode: 'numeric',
  enterKeyHint: 'done',
  autoCapitalize: 'none',
  capture: 'user',
  rel: 'noopener',
  target: '_blank',
  colSpan: 2,
  rowSpan: 2,
  start: 2,
  rows: 2,
  cols: 20,
  maxLength: 10,
  minLength: 1,
  size: 3,
  width: 10,
  height: 10,
  min: 0,
  max: 10,
  step: 1,
  value: 'x',
  defaultValue: 'x',
  defaultChecked: true,
};
const table = (child: React.ReactElement) => <table>{child}</table>;
const row = (child: React.ReactElement) => table(<tbody>{child}</tbody>);
const PARENTS: Partial<Record<string, (child: React.ReactElement) => React.ReactElement>> = {
  li: (child) => <ul>{child}</ul>,
  option: (child) => <select>{child}</select>,
  thead: table,
  tbody: table,
  tfoot: table,
  tr: row,
  td: (child) => row(<tr>{child}</tr>),
  th: (child) => row(<tr>{child}</tr>),
};

describe('React accepts every attribute the lists keep', () => {
  const tags = [
    'div',
    'span',
    'ul',
    'table',
    'tbody',
    'thead',
    'tfoot',
    'tr',
    ...Object.keys(NATIVE_TAG_PROPS),
  ] as Tags[];

  it.each(tags)('renders <%s> with every kept attribute and logs nothing', (tag) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const own = (NATIVE_TAG_PROPS as Record<string, string | undefined>)[tag];
      const keys = [...names(NATIVE_GLOBAL_PROPS), ...(own ? names(own) : [])].filter(
        (key) => key !== 'ref',
      );
      // A control takes either the controlled or the default value, not both.
      for (const skip of [
        ['defaultValue', 'defaultChecked'],
        ['value', 'checked'],
      ]) {
        const props: Record<string, unknown> = {
          ref: () => {},
          'data-x': '1',
          'aria-label': 'l',
        };
        for (const key of keys) if (!skip.includes(key)) props[key] = VALUES[key] ?? 'x';
        // Values React checks against other props: a select with `multiple` takes arrays, and
        // `formAction` goes with a submit button or input.
        if (tag === 'select')
          for (const key of ['value', 'defaultValue']) if (key in props) props[key] = ['x'];
        if (tag === 'button' || tag === 'input') props.type = 'submit';
        const noCapture = names(NATIVE_NO_CAPTURE_EVENTS);
        for (const event of names(NATIVE_EVENT_NAMES)) {
          props[`on${event}`] = () => {};
          if (!noCapture.includes(event)) props[`on${event}Capture`] = () => {};
        }
        const wrap = PARENTS[tag] ?? ((child: React.ReactElement) => child);
        const kept = getNativeElementProps(tag, { ...props, appearance: 'x' });
        expect(kept).not.toHaveProperty('appearance');
        expect(Object.keys(kept).sort()).toEqual(Object.keys(props).sort());
        const { unmount } = render(wrap(React.createElement(tag, kept as object)));
        unmount();
      }
      expect({ error: error.mock.calls, warn: warn.mock.calls }).toEqual({ error: [], warn: [] });
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
  });
});
