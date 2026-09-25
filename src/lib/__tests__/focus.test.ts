import { describe, it, expect, afterEach } from 'vitest';
import {
  FOCUSABLE_SELECTOR,
  isFocusable,
  isTabbable,
  getTabbableElements,
  getFirstTabbable,
  getLastTabbable,
  focusElement,
  isConnectedAndFocusable,
  containsFocus,
} from '../focus';

function mount(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

function ids(elements: Element[]): string[] {
  return elements.map((el) => el.id);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('FOCUSABLE_SELECTOR', () => {
  it('matches the natively focusable elements', () => {
    const c = mount(`
      <a id="a" href="#">a</a><button id="b">b</button><input id="i"><select id="s"></select>
      <textarea id="t"></textarea><div id="d" tabindex="0">d</div><span id="plain">p</span>`);
    const matched = Array.from(c.querySelectorAll(FOCUSABLE_SELECTOR)).map((el) => el.id);
    expect(matched).toEqual(['a', 'b', 'i', 's', 't', 'd']);
  });
});

describe('getTabbableElements (overlays#3)', () => {
  it('returns the tabbable elements in tab order', () => {
    const c = mount(`
      <button id="one">1</button>
      <a id="link" href="#">link</a>
      <input id="field">
      <div id="focusable-div" tabindex="0">div</div>
      <textarea id="area"></textarea>`);
    expect(ids(getTabbableElements(c))).toEqual(['one', 'link', 'field', 'focusable-div', 'area']);
  });

  it('excludes disabled controls, including those inside a disabled fieldset', () => {
    const c = mount(`
      <button id="cancel">Cancel</button>
      <button id="save" disabled>Save</button>
      <fieldset disabled><legend><button id="in-legend">L</button></legend><input id="in-fieldset"></fieldset>`);
    expect(ids(getTabbableElements(c))).toEqual(['cancel', 'in-legend']);
  });

  it('excludes hidden inputs and tabindex=-1', () => {
    const c = mount(`
      <input id="hidden" type="hidden">
      <button id="minus" tabindex="-1">minus</button>
      <button id="ok">ok</button>`);
    expect(ids(getTabbableElements(c))).toEqual(['ok']);
  });

  it('excludes content inside inert, hidden and display:none ancestors, and visibility:hidden', () => {
    const c = mount(`
      <div inert><button id="inert">x</button></div>
      <div hidden><button id="hidden-attr">x</button></div>
      <div style="display:none"><button id="display-none">x</button></div>
      <div style="visibility:hidden"><button id="invisible">x</button></div>
      <button id="visible">ok</button>`);
    expect(ids(getTabbableElements(c))).toEqual(['visible']);
  });

  it('excludes anchors without href and non-focusable elements', () => {
    const c = mount(
      `<a id="no-href">x</a><span id="span">y</span><a id="with-href" href="/">z</a>`,
    );
    expect(ids(getTabbableElements(c))).toEqual(['with-href']);
  });

  it('keeps only the checked radio of a named group', () => {
    const c = mount(`
      <input type="radio" name="size" id="s" value="s">
      <input type="radio" name="size" id="m" value="m" checked>
      <input type="radio" name="size" id="l" value="l">
      <button id="after">after</button>`);
    expect(ids(getTabbableElements(c))).toEqual(['m', 'after']);
  });

  it('keeps every radio of a named group without a checked radio (browsers enter it at the first going forward, at the last going backward)', () => {
    const c = mount(`
      <input type="radio" name="tone" id="warm">
      <input type="radio" name="tone" id="cool">
      <input type="radio" id="unnamed-1"><input type="radio" id="unnamed-2">`);
    expect(ids(getTabbableElements(c))).toEqual(['warm', 'cool', 'unnamed-1', 'unnamed-2']);
    expect(isTabbable(c.querySelector('#cool')!)).toBe(true);
  });

  it('getLastTabbable returns the last radio of a trailing unchecked group (Shift+Tab wrap target)', () => {
    const c = mount(`
      <button id="before">before</button>
      <input type="radio" name="g" id="r1">
      <input type="radio" name="g" id="r2">`);
    expect(getLastTabbable(c)?.id).toBe('r2');
    expect(getFirstTabbable(c)?.id).toBe('before');
  });

  it('getFirstTabbable returns the first radio of a leading unchecked group (Tab wrap target)', () => {
    // Regression guard, not a red-first test: the earlier "first member is the stop of an
    // unchecked group" rule also yields first = r1 and last = after here.
    const c = mount(`
      <input type="radio" name="g" id="r1">
      <input type="radio" name="g" id="r2">
      <button id="after">after</button>`);
    expect(getFirstTabbable(c)?.id).toBe('r1');
    expect(getLastTabbable(c)?.id).toBe('after');
  });

  it('skips disabled and hidden members of an unchecked group', () => {
    const c = mount(`
      <input type="radio" name="g" id="r1">
      <input type="radio" name="g" id="r2">
      <input type="radio" name="g" id="r3" disabled>
      <div hidden><input type="radio" name="g" id="r4"></div>`);
    expect(ids(getTabbableElements(c))).toEqual(['r1', 'r2']);
    expect(getLastTabbable(c)?.id).toBe('r2');
  });

  it('skips a whole checked group whose checked radio cannot take focus', () => {
    // Regression guard, not a red-first test: the earlier rule (only the checked radio of a checked
    // group is a stop) gives the same result; it pins that a disabled checked radio does not hand
    // the stop to another member.
    const c = mount(`
      <input type="radio" name="g" id="r1">
      <input type="radio" name="g" id="r2" checked disabled>
      <button id="after">after</button>`);
    expect(ids(getTabbableElements(c))).toEqual(['after']);
  });

  it('while focus is in a named group, the focused radio is its only tab stop (native Tab skips the rest of the group)', () => {
    const c = mount(`
      <button id="before">before</button>
      <input type="radio" name="g" id="r1">
      <input type="radio" name="g" id="r2">`);
    c.querySelector<HTMLInputElement>('#r1')!.focus();
    // Tab from r1 leaves the group, so r1 is the last stop and a trap wraps from it.
    expect(ids(getTabbableElements(c))).toEqual(['before', 'r1']);
    expect(getLastTabbable(c)?.id).toBe('r1');
    c.querySelector<HTMLInputElement>('#r2')!.focus();
    expect(ids(getTabbableElements(c))).toEqual(['before', 'r2']);
    expect(isTabbable(c.querySelector('#r1')!)).toBe(false);
    c.querySelector<HTMLButtonElement>('#before')!.focus();
    expect(ids(getTabbableElements(c))).toEqual(['before', 'r1', 'r2']);
  });

  it('while an unchecked member of a checked group has focus, it is the group stop instead of the checked radio', () => {
    const c = mount(`
      <input type="radio" name="g" id="checked" checked>
      <input type="radio" name="g" id="other">
      <button id="after">after</button>`);
    expect(ids(getTabbableElements(c))).toEqual(['checked', 'after']);
    c.querySelector<HTMLInputElement>('#other')!.focus();
    expect(ids(getTabbableElements(c))).toEqual(['other', 'after']);
  });

  it('treats groups in different forms (same name) independently', () => {
    const c = mount(`
      <form><input type="radio" name="g" id="a1" checked><input type="radio" name="g" id="a2"></form>
      <form><input type="radio" name="g" id="b1"><input type="radio" name="g" id="b2"></form>`);
    expect(ids(getTabbableElements(c))).toEqual(['a1', 'b1', 'b2']);
  });

  it('skips closed <details> content except its summary', () => {
    const c = mount(`
      <details id="closed"><summary id="sum">More</summary><button id="inside">x</button></details>
      <details open><summary id="sum-open">Open</summary><button id="inside-open">y</button></details>`);
    expect(ids(getTabbableElements(c))).toEqual(['sum', 'sum-open', 'inside-open']);
  });

  it('treats contenteditable as tabbable', () => {
    const c = mount(
      `<div id="editor" contenteditable="true">text</div><div id="off" contenteditable="false">x</div>`,
    );
    expect(ids(getTabbableElements(c))).toEqual(['editor']);
  });

  it('puts positive tabindex first, then DOM order', () => {
    const c = mount(`
      <button id="a">a</button>
      <button id="c" tabindex="2">c</button>
      <button id="b" tabindex="1">b</button>
      <button id="d">d</button>`);
    expect(ids(getTabbableElements(c))).toEqual(['b', 'c', 'a', 'd']);
  });

  it('includes the container itself only when asked and it is tabbable', () => {
    const c = mount(`<button id="child">x</button>`);
    c.id = 'container';
    c.tabIndex = 0;
    expect(ids(getTabbableElements(c))).toEqual(['child']);
    expect(ids(getTabbableElements(c, { includeContainer: true }))).toEqual(['container', 'child']);
    c.tabIndex = -1;
    expect(ids(getTabbableElements(c, { includeContainer: true }))).toEqual(['child']);
  });

  it('getFirstTabbable / getLastTabbable skip untabbable edges', () => {
    const c = mount(`
      <button id="disabled-first" disabled>x</button>
      <button id="cancel">Cancel</button>
      <button id="ok">OK</button>
      <button id="save" disabled>Save</button>`);
    expect(getFirstTabbable(c)?.id).toBe('cancel');
    expect(getLastTabbable(c)?.id).toBe('ok');
    const empty = mount('<span>nothing</span>');
    expect(getFirstTabbable(empty)).toBeNull();
    expect(getLastTabbable(empty)).toBeNull();
  });
});

describe('isFocusable / isTabbable', () => {
  it('a tabindex=-1 element is focusable but not tabbable', () => {
    const c = mount(`<div id="panel" tabindex="-1">x</div>`);
    const panel = c.querySelector('#panel')!;
    expect(isFocusable(panel)).toBe(true);
    expect(isTabbable(panel)).toBe(false);
  });

  it('disabled and hidden elements are neither', () => {
    const c = mount(
      `<button id="d" disabled>x</button><div hidden><button id="h">y</button></div>`,
    );
    expect(isFocusable(c.querySelector('#d')!)).toBe(false);
    expect(isFocusable(c.querySelector('#h')!)).toBe(false);
    expect(isTabbable(c.querySelector('#h')!)).toBe(false);
  });

  it('a plain element is not focusable', () => {
    const c = mount(`<span id="s">x</span>`);
    expect(isFocusable(c.querySelector('#s')!)).toBe(false);
  });
});

describe('focusElement', () => {
  it('focuses a focusable element and reports success', () => {
    const c = mount(`<button id="b">b</button>`);
    const button = c.querySelector<HTMLButtonElement>('#b')!;
    expect(focusElement(button)).toBe(true);
    expect(button).toHaveFocus();
  });

  it('returns false for null, disconnected or unfocusable elements', () => {
    expect(focusElement(null)).toBe(false);
    expect(focusElement(undefined)).toBe(false);
    expect(focusElement(document.createElement('button'))).toBe(false);
    const c = mount(`<button id="d" disabled>x</button>`);
    expect(focusElement(c.querySelector<HTMLButtonElement>('#d'))).toBe(false);
  });

  it('passes focus options through', () => {
    const c = mount(`<button id="b">b</button>`);
    expect(focusElement(c.querySelector<HTMLButtonElement>('#b'), { preventScroll: true })).toBe(
      true,
    );
  });
});

describe('isConnectedAndFocusable / containsFocus', () => {
  it('reports connected focusable elements', () => {
    const c = mount(`<button id="b">b</button>`);
    expect(isConnectedAndFocusable(c.querySelector('#b'))).toBe(true);
    expect(isConnectedAndFocusable(document.createElement('button'))).toBe(false);
    expect(isConnectedAndFocusable(null)).toBe(false);
  });

  it('reports whether focus is inside a container', () => {
    const c = mount(`<button id="in">in</button>`);
    const outside = mount(`<button id="out">out</button>`);
    c.querySelector<HTMLButtonElement>('#in')!.focus();
    expect(containsFocus(c)).toBe(true);
    expect(containsFocus(outside)).toBe(false);
    expect(containsFocus(null)).toBe(false);
  });
});
