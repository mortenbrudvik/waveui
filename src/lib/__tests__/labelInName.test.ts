import { describe, it, expect, vi, afterEach } from 'vitest';
import * as React from 'react';
import { render } from '@testing-library/react';
import { hasTextLabel, hasRenderedTextLabel, observeTextLabel } from '../labelInName';

// This file is `.ts` (spec §2.2/§8), so elements are built with `createElement`.
const h = React.createElement;

function mount(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

/** Waits for pending `MutationObserver` records (delivered in a microtask) to be dispatched. */
function flushMutations(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('hasTextLabel (C-SLOTS naming predicate)', () => {
  it.each([
    ['X', 'X'],
    ['x', 'x'],
    ['×', '×'],
    ['+', '+'],
    ['empty string', ''],
    ['punctuation and whitespace only', ' ×  - '],
    ['a lone digit', 7],
    ['null', null],
    ['undefined', undefined],
    ['true', true],
    ['false', false],
  ])('%s is not a text label', (_name, node) => {
    expect(hasTextLabel(node)).toBe(false);
  });

  it.each([
    ['OK', 'OK'],
    ["['O', 'K']", ['O', 'K']],
    ['10', 10],
    ['a bigint', BigInt(42)],
    ['<b>Close</b>', h('b', null, 'Close')],
    ['a non-Latin word', 'Закрыть'],
    ['a letter and a digit', 'A1'],
    ['a glyph followed by a word', '× Reset'],
  ])('%s is a text label', (_name, node) => {
    expect(hasTextLabel(node)).toBe(true);
  });

  it('counts letters and digits across strings, elements and fragments', () => {
    expect(hasTextLabel(['×', h('span', null, 'O'), 'K'])).toBe(true);
    expect(hasTextLabel(h(React.Fragment, null, 'O', h('i', null, 'K')))).toBe(true);
    expect(hasTextLabel(h('span', null, h('b', null, h('i', null, 'Go'))))).toBe(true);
  });

  it('ignores aria-hidden and hidden subtrees', () => {
    expect(hasTextLabel(h('span', { 'aria-hidden': true }, 'Close'))).toBe(false);
    expect(hasTextLabel(h('span', { 'aria-hidden': 'true' }, 'Close'))).toBe(false);
    expect(hasTextLabel(h('span', { hidden: true }, 'Close'))).toBe(false);
    expect(hasTextLabel(['C', h('span', { 'aria-hidden': true }, 'lose')])).toBe(false);
    // aria-hidden="false" and hidden={false} hide nothing.
    expect(hasTextLabel(h('span', { 'aria-hidden': false }, 'Close'))).toBe(true);
    expect(hasTextLabel(h('span', { 'aria-hidden': 'false' }, 'Close'))).toBe(true);
    expect(hasTextLabel(h('span', { hidden: false }, 'Close'))).toBe(true);
  });

  it('ignores SVG <title>/<desc>, <script>, <style> and <template>', () => {
    expect(hasTextLabel(h('svg', null, h('title', null, 'Close')))).toBe(false);
    expect(hasTextLabel(h('svg', null, h('desc', null, 'Close')))).toBe(false);
    expect(hasTextLabel(h('script', null, 'Close'))).toBe(false);
    expect(hasTextLabel(h('style', null, 'Close'))).toBe(false);
    expect(hasTextLabel(h('template', null, 'Close'))).toBe(false);
  });

  it('does not read text rendered by a component (the DOM check finds it after mount)', () => {
    const Label = () => 'Close';
    expect(hasTextLabel(h(Label))).toBe(false);
    expect(hasTextLabel(h('span', null, h(Label)))).toBe(false);
  });

  it('reads a Set and other re-iterable collections', () => {
    expect(hasTextLabel(new Set(['O', 'K']))).toBe(true);
    expect(hasTextLabel(new Set(['×']))).toBe(false);
    const reiterable: Iterable<React.ReactNode> = {
      *[Symbol.iterator]() {
        yield 'O';
        yield 'K';
      },
    };
    expect(hasTextLabel(reiterable)).toBe(true);
    // Reading it once did not exhaust it.
    expect(Array.from(reiterable)).toEqual(['O', 'K']);
  });

  it('never reads a one-shot iterator such as a generator', () => {
    const produced = vi.fn();
    function* label() {
      produced();
      yield 'O';
      yield 'K';
    }
    const generator = label();
    expect(hasTextLabel(generator)).toBe(false);
    expect(hasTextLabel([generator])).toBe(false);
    expect(hasTextLabel(h('span', null, generator))).toBe(false);
    expect(produced).not.toHaveBeenCalled();
    // The generator still yields everything to React.
    expect(Array.from(generator)).toEqual(['O', 'K']);
  });

  it('treats non-node values as no label', () => {
    expect(hasTextLabel({})).toBe(false);
    expect(hasTextLabel({ children: 'Close' })).toBe(false);
    expect(hasTextLabel(Promise.resolve('Close'))).toBe(false);
    expect(hasTextLabel(() => 'Close')).toBe(false);
    expect(hasTextLabel(Symbol('Close'))).toBe(false);
  });

  it('stops counting once two characters are found', () => {
    const tail = vi.fn(() => 'unreached');
    const items = {
      *[Symbol.iterator]() {
        yield 'OK';
        yield tail();
      },
    };
    expect(hasTextLabel(items)).toBe(true);
    expect(tail).not.toHaveBeenCalled();
  });
});

describe('hasRenderedTextLabel', () => {
  it.each([
    ['X', '<button>X</button>', false],
    ['×', '<button>×</button>', false],
    ['+', '<button>+</button>', false],
    ['OK', '<button>OK</button>', true],
    ['split text nodes', '<button>O<b>K</b></button>', true],
    ['an aria-hidden span', '<button><span aria-hidden="true">Close</span></button>', false],
    ['a hidden span', '<button><span hidden>Close</span></button>', false],
    ['aria-hidden="false"', '<button><span aria-hidden="false">Close</span></button>', true],
    ['an SVG <title>', '<button><svg><title>Close</title></svg></button>', false],
    ['an SVG <desc>', '<button><svg><desc>Close</desc></svg></button>', false],
    ['a <script>', '<button><script>Close</script></button>', false],
    // Valid CSS (jsdom logs a parse error for invalid CSS), full of letters.
    ['a <style>', '<button><style>.close { color: red }</style></button>', false],
    ['a <template>', '<button><template>Close</template></button>', false],
    ['visually hidden text', '<button><span class="sr-only">Close</span></button>', true],
    ['an icon and text', '<button><svg aria-hidden="true"></svg>Reset</button>', true],
  ])('%s → %s', (_name, html, expected) => {
    const button = mount(html).querySelector('button')!;
    expect(hasRenderedTextLabel(button)).toBe(expected);
  });

  it('finds text rendered by a child component', () => {
    const Label = () => 'Close';
    const { container } = render(h('button', { type: 'button' }, h(Label)));
    expect(hasRenderedTextLabel(container.querySelector('button')!)).toBe(true);
  });

  it('stops walking once two characters are found', () => {
    const button = mount('<button>OK<span>more</span><span>text</span></button>').querySelector(
      'button',
    )!;
    const createTreeWalker = document.createTreeWalker.bind(document);
    const walkers: TreeWalker[] = [];
    const spy = vi
      .spyOn(document, 'createTreeWalker')
      .mockImplementation((...args: Parameters<Document['createTreeWalker']>) => {
        const walker = createTreeWalker(...args);
        vi.spyOn(walker, 'nextNode');
        walkers.push(walker);
        return walker;
      });
    try {
      expect(hasRenderedTextLabel(button)).toBe(true);
    } finally {
      spy.mockRestore();
    }
    expect(walkers).toHaveLength(1);
    // One step, to the "OK" text node, is enough.
    expect(walkers[0].nextNode).toHaveBeenCalledTimes(1);
  });

  it.each<[string, React.ReactNode]>([
    ['X', 'X'],
    ['×', '×'],
    ['+', '+'],
    ['OK', 'OK'],
    ["['O', 'K']", ['O', 'K']],
    ['10', 10],
    ['<b>Close</b>', h('b', null, 'Close')],
    ['an aria-hidden span', h('span', { 'aria-hidden': true }, 'Close')],
    ['a hidden span', h('span', { hidden: true }, 'Close')],
    ['an SVG <title>', h('svg', null, h('title', null, 'Close'))],
    ['an SVG <desc>', h('svg', null, h('desc', null, 'Close'))],
    ['a glyph and a hidden word', ['×', h('span', { key: 'word', hidden: true }, 'Close')]],
    ['a Set', new Set(['O', 'K'])],
    ['nested fragments', h(React.Fragment, null, 'O', h(React.Fragment, null, h('i', null, 'K')))],
  ])('agrees with hasTextLabel on the same markup: %s', (_name, node) => {
    const { container } = render(h('button', { type: 'button' }, node));
    expect(hasRenderedTextLabel(container.querySelector('button')!)).toBe(hasTextLabel(node));
  });
});

describe('observeTextLabel', () => {
  it('fires when text changes', async () => {
    const button = mount('<button>X</button>').querySelector('button')!;
    const onChange = vi.fn();
    const disconnect = observeTextLabel(button, onChange);
    button.firstChild!.nodeValue = 'Close';
    await flushMutations();
    expect(onChange).toHaveBeenCalled();
    expect(hasRenderedTextLabel(button)).toBe(true);
    disconnect();
  });

  it('fires when children are added or removed, at any depth', async () => {
    const button = mount('<button><span></span></button>').querySelector('button')!;
    const onChange = vi.fn();
    const disconnect = observeTextLabel(button, onChange);
    button.querySelector('span')!.append('Close');
    await flushMutations();
    expect(onChange).toHaveBeenCalledTimes(1);
    button.querySelector('span')!.remove();
    await flushMutations();
    expect(onChange).toHaveBeenCalledTimes(2);
    disconnect();
  });

  it('fires when hidden or aria-hidden changes', async () => {
    const button = mount('<button><span hidden>Close</span></button>').querySelector('button')!;
    const span = button.querySelector('span')!;
    const onChange = vi.fn();
    const disconnect = observeTextLabel(button, onChange);
    span.removeAttribute('hidden');
    await flushMutations();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(hasRenderedTextLabel(button)).toBe(true);
    span.setAttribute('aria-hidden', 'true');
    await flushMutations();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(hasRenderedTextLabel(button)).toBe(false);
    disconnect();
  });

  it('ignores other attribute changes', async () => {
    const button = mount('<button><span>Close</span></button>').querySelector('button')!;
    const onChange = vi.fn();
    const disconnect = observeTextLabel(button, onChange);
    button.querySelector('span')!.className = 'font-semibold';
    button.setAttribute('data-state', 'open');
    await flushMutations();
    expect(onChange).not.toHaveBeenCalled();
    disconnect();
  });

  it('stops after disconnect', async () => {
    const button = mount('<button><span hidden>X</span></button>').querySelector('button')!;
    const span = button.querySelector('span')!;
    const onChange = vi.fn();
    const disconnect = observeTextLabel(button, onChange);
    disconnect();
    span.firstChild!.nodeValue = 'Close';
    span.append('!');
    span.removeAttribute('hidden');
    await flushMutations();
    expect(onChange).not.toHaveBeenCalled();
  });
});
