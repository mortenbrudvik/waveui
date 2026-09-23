import { describe, it, expect, afterEach } from 'vitest';
import { getDirection, getArrowIntent, type Direction } from '../direction';

function mount(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('dir');
});

describe('getDirection (input-basic#22, input-datetime#17, layout#27)', () => {
  it('defaults to ltr', () => {
    const c = mount('<span id="x">x</span>');
    expect(getDirection(c.querySelector('#x'))).toBe('ltr');
    expect(getDirection()).toBe('ltr');
    expect(getDirection(null)).toBe('ltr');
  });

  it('uses the nearest dir attribute', () => {
    const c = mount(`
      <div dir="rtl"><span id="in-rtl">a</span>
        <div dir="ltr"><span id="in-ltr">b</span></div>
      </div>`);
    expect(getDirection(c.querySelector('#in-rtl'))).toBe('rtl');
    expect(getDirection(c.querySelector('#in-ltr'))).toBe('ltr');
  });

  it('reads the dir attribute case-insensitively', () => {
    const c = mount('<div dir="RTL"><span id="x">x</span></div>');
    expect(getDirection(c.querySelector('#x'))).toBe('rtl');
  });

  it('falls back to the computed direction (CSS direction: rtl)', () => {
    const c = mount('<div style="direction: rtl"><span id="x">x</span></div>');
    expect(getDirection(c.querySelector('#x'))).toBe('rtl');
  });

  it('stops at dir="auto" and uses the computed direction instead of an outer dir attribute', () => {
    // Browsers resolve dir="auto" from the content (Latin text → ltr), not from the rtl ancestor.
    const c = mount('<div dir="rtl"><div dir="auto"><span id="x">x</span></div></div>');
    expect(getDirection(c.querySelector('#x'))).toBe('ltr');
  });

  it('uses <html dir> for elements and for the document default', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const c = mount('<span id="x">x</span>');
    expect(getDirection(c.querySelector('#x'))).toBe('rtl');
    expect(getDirection()).toBe('rtl');
  });

  it('uses document.dir for a detached element', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    expect(getDirection(document.createElement('span'))).toBe('rtl');
  });
});

describe('getArrowIntent', () => {
  const cases: Array<
    [
      key: string,
      orientation: 'horizontal' | 'vertical' | 'both',
      dir: Direction,
      expected: 'next' | 'prev' | null,
    ]
  > = [
    ['ArrowRight', 'horizontal', 'ltr', 'next'],
    ['ArrowLeft', 'horizontal', 'ltr', 'prev'],
    ['ArrowRight', 'horizontal', 'rtl', 'prev'],
    ['ArrowLeft', 'horizontal', 'rtl', 'next'],
    ['ArrowDown', 'horizontal', 'ltr', null],
    ['ArrowUp', 'horizontal', 'rtl', null],
    ['ArrowDown', 'vertical', 'ltr', 'next'],
    ['ArrowUp', 'vertical', 'ltr', 'prev'],
    ['ArrowDown', 'vertical', 'rtl', 'next'],
    ['ArrowUp', 'vertical', 'rtl', 'prev'],
    ['ArrowRight', 'vertical', 'ltr', null],
    ['ArrowLeft', 'vertical', 'rtl', null],
    ['ArrowRight', 'both', 'ltr', 'next'],
    ['ArrowLeft', 'both', 'ltr', 'prev'],
    ['ArrowDown', 'both', 'ltr', 'next'],
    ['ArrowUp', 'both', 'ltr', 'prev'],
    ['ArrowRight', 'both', 'rtl', 'prev'],
    ['ArrowLeft', 'both', 'rtl', 'next'],
    ['ArrowDown', 'both', 'rtl', 'next'],
    ['ArrowUp', 'both', 'rtl', 'prev'],
    ['Home', 'both', 'ltr', null],
    ['Enter', 'horizontal', 'ltr', null],
  ];

  it.each(cases)('%s (%s, %s) → %s', (key, orientation, dir, expected) => {
    expect(getArrowIntent(key, { orientation, dir })).toBe(expected);
  });

  it('works with getDirection for an element in an RTL subtree', () => {
    const c = mount('<div dir="rtl"><div role="radiogroup" id="group"></div></div>');
    const dir = getDirection(c.querySelector('#group'));
    expect(getArrowIntent('ArrowRight', { orientation: 'horizontal', dir })).toBe('prev');
  });
});
