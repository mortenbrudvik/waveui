import { afterEach, describe, expect, it } from 'vitest';
import type * as React from 'react';
import {
  INTERACTIVE_SELECTOR,
  endsTextSelection,
  isDisabledTrigger,
  isEditableTarget,
  isForeignEvent,
  isOwnEvent,
} from '../events';

/** Adds `html` to the document and returns its root element (removed after each test). */
function host(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.append(div);
  return div;
}

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

/** A synthetic event as React passes it: the DOM target and the handling element. */
function eventFrom(target: EventTarget | null, currentTarget: HTMLElement) {
  return { target, currentTarget } as unknown as React.SyntheticEvent<HTMLElement>;
}

describe('isOwnEvent', () => {
  it('is true for an event that started at the handling element or inside its DOM', () => {
    const root = host('<div id="trigger"><button type="button">Row</button></div>');
    const trigger = root.querySelector<HTMLElement>('#trigger')!;
    expect(isOwnEvent(eventFrom(trigger, trigger))).toBe(true);
    expect(isOwnEvent(eventFrom(trigger.querySelector('button'), trigger))).toBe(true);
  });

  it('is false for an event React bubbled from a portal rendered elsewhere in the document', () => {
    const root = host(
      '<div id="trigger"></div><div id="portal"><button type="button">In a portal</button></div>',
    );
    const trigger = root.querySelector<HTMLElement>('#trigger')!;
    const portalButton = root.querySelector('#portal button');
    expect(isOwnEvent(eventFrom(portalButton, trigger))).toBe(false);
  });

  it('is false without a node target, and accepts a node of another realm (duck typed)', () => {
    const root = host('<div id="trigger"></div>');
    const trigger = root.querySelector<HTMLElement>('#trigger')!;
    expect(isOwnEvent(eventFrom(null, trigger))).toBe(false);
    expect(isOwnEvent(eventFrom(window, trigger))).toBe(false);

    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameTrigger = frameDocument.createElement('div');
    const frameChild = frameDocument.createElement('span');
    frameTrigger.append(frameChild);
    frameDocument.body.append(frameTrigger);
    expect(isOwnEvent(eventFrom(frameChild, frameTrigger))).toBe(true);
  });
});

describe('isDisabledTrigger', () => {
  it('is true for an aria-disabled="true" element at or inside the handling element', () => {
    const root = host(
      '<span id="wrapper"><button type="button" aria-disabled="true"><i>icon</i></button></span>',
    );
    const wrapper = root.querySelector<HTMLElement>('#wrapper')!;
    const button = root.querySelector<HTMLElement>('button')!;
    expect(isDisabledTrigger(eventFrom(button, button))).toBe(true);
    expect(isDisabledTrigger(eventFrom(button.querySelector('i'), wrapper))).toBe(true);
  });

  it('is false for an enabled trigger, aria-disabled="false" and a disabled ancestor outside it', () => {
    const root = host(
      '<div aria-disabled="true"><button id="enabled" type="button">A</button></div>' +
        '<button id="not-disabled" type="button" aria-disabled="false">B</button>',
    );
    const enabled = root.querySelector<HTMLElement>('#enabled')!;
    const notDisabled = root.querySelector<HTMLElement>('#not-disabled')!;
    expect(isDisabledTrigger(eventFrom(enabled, enabled))).toBe(false);
    expect(isDisabledTrigger(eventFrom(notDisabled, notDisabled))).toBe(false);
    expect(isDisabledTrigger(eventFrom(null, enabled))).toBe(false);
  });
});

describe('isEditableTarget', () => {
  it.each(['text', 'search', 'url', 'tel', 'email', 'password', 'number'])(
    'is true for <input type="%s">',
    (type) => {
      const root = host(`<input type="${type}" aria-label="field" />`);
      expect(isEditableTarget(root.querySelector('input'))).toBe(true);
    },
  );

  it('is true for an input without a type and for a textarea', () => {
    const root = host('<input aria-label="a" /><textarea aria-label="b"></textarea>');
    expect(isEditableTarget(root.querySelector('input'))).toBe(true);
    expect(isEditableTarget(root.querySelector('textarea'))).toBe(true);
  });

  it.each(['checkbox', 'radio', 'button', 'range', 'date', 'color', 'file', 'hidden'])(
    'is false for <input type="%s">',
    (type) => {
      const root = host(`<input type="${type}" aria-label="field" />`);
      expect(isEditableTarget(root.querySelector('input'))).toBe(false);
    },
  );

  it('is true inside a contenteditable element, and false where editing is switched off', () => {
    const root = host(
      '<div id="editor" contenteditable="true"><b id="inside">text</b></div>' +
        '<div contenteditable="true"><span id="off" contenteditable="false">fixed</span></div>',
    );
    expect(isEditableTarget(root.querySelector('#editor'))).toBe(true);
    expect(isEditableTarget(root.querySelector('#inside'))).toBe(true);
    expect(isEditableTarget(root.querySelector('#off'))).toBe(false);
  });

  it('reads isContentEditable where the engine implements it', () => {
    const root = host('<div id="a"></div><div id="b" contenteditable="true"></div>');
    const a = root.querySelector<HTMLElement>('#a')!;
    const b = root.querySelector<HTMLElement>('#b')!;
    Object.defineProperty(a, 'isContentEditable', { configurable: true, value: true });
    Object.defineProperty(b, 'isContentEditable', { configurable: true, value: false });
    expect(isEditableTarget(a)).toBe(true);
    expect(isEditableTarget(b)).toBe(false);
  });

  it('is false for other elements, text nodes, the window and null', () => {
    const root = host('<button type="button">A</button><div role="textbox">B</div>');
    expect(isEditableTarget(root.querySelector('button'))).toBe(false);
    expect(isEditableTarget(root.querySelector('div'))).toBe(false);
    expect(isEditableTarget(document.createTextNode('text'))).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('isForeignEvent', () => {
  /** A selectable row: its cells carry a tabindex for the grid's own navigation. */
  function row(cells: string): { row: HTMLElement; root: HTMLElement } {
    const root = host(`<table><tbody><tr id="row">${cells}</tr></tbody></table>`);
    return { row: root.querySelector<HTMLElement>('#row')!, root };
  }

  it('is false for an event that started on the container or on plain content inside it', () => {
    const { row: tr } = row('<td><span id="text">Alice</span></td>');
    const text = tr.querySelector('#text')!;
    expect(isForeignEvent(eventFrom(tr, tr))).toBe(false);
    expect(isForeignEvent(eventFrom(text, tr))).toBe(false);
    expect(isForeignEvent(eventFrom(text.firstChild, tr))).toBe(false);
  });

  it.each([
    ['a button', '<button type="button"><b id="t">Edit</b></button>'],
    ['a link', '<a href="#a"><b id="t">Profile</b></a>'],
    ['an input', '<input id="t" aria-label="Note" />'],
    ['a label', '<label><b id="t">Name</b><input /></label>'],
    ['an element with tabindex', '<span tabindex="-1"><b id="t">Chip</b></span>'],
    ['a scripted role="button"', '<span role="button"><b id="t">Custom</b></span>'],
    ['a scripted role="checkbox"', '<span role="checkbox" aria-checked="false" id="t"></span>'],
  ])('is true for an event that started inside %s in the container', (_name, html) => {
    const { row: tr } = row(`<td>${html}</td>`);
    expect(isForeignEvent(eventFrom(tr.querySelector('#t'), tr))).toBe(true);
  });

  it('is true for an event React bubbled from a portal and for an event without a node target', () => {
    const { row: tr, root } = row('<td>Alice</td>');
    const portal = document.createElement('p');
    root.append(portal);
    expect(isForeignEvent(eventFrom(portal, tr))).toBe(true);
    expect(isForeignEvent(eventFrom(null, tr))).toBe(true);
    expect(isForeignEvent(eventFrom(window, tr))).toBe(true);
  });

  it('skips the container’s own parts (`isOwnPart`), such as the cells of a grid row', () => {
    const { row: tr } = row(
      '<td tabindex="0"><span id="text">Alice</span></td><td tabindex="-1"><button type="button" id="b">Edit</button></td>',
    );
    const cellOfRow = (el: Element) => el.parentElement === tr;
    const text = tr.querySelector('#text');
    expect(isForeignEvent(eventFrom(text, tr))).toBe(true);
    expect(isForeignEvent(eventFrom(text, tr), { isOwnPart: cellOfRow })).toBe(false);
    expect(isForeignEvent(eventFrom(tr.querySelector('#b'), tr), { isOwnPart: cellOfRow })).toBe(
      true,
    );
  });

  it('takes another selector of interactive elements (`interactive`)', () => {
    const { row: tr } = row('<td><span data-action=""><b id="t">More</b></span></td>');
    const target = tr.querySelector('#t');
    expect(isForeignEvent(eventFrom(target, tr))).toBe(false);
    expect(
      isForeignEvent(eventFrom(target, tr), {
        interactive: `${INTERACTIVE_SELECTOR}, [data-action]`,
      }),
    ).toBe(true);
  });
});

describe('endsTextSelection', () => {
  /** A click as React passes it to the row's handler. */
  function clickOn(currentTarget: HTMLElement) {
    return { target: currentTarget, currentTarget } as unknown as React.MouseEvent<HTMLElement>;
  }

  it('is true while the document holds a selection that is not collapsed and reaches the element', () => {
    const root = host('<div id="row"><span id="cell">Alice Smith</span></div><p id="other">x</p>');
    const rowElement = root.querySelector<HTMLElement>('#row')!;
    const text = root.querySelector('#cell')!.firstChild!;
    const selection = document.getSelection()!;
    selection.setBaseAndExtent(text, 0, text, 5);
    expect(endsTextSelection(clickOn(rowElement))).toBe(true);
    // A selection that starts outside the element and ends inside it reaches it too.
    selection.setBaseAndExtent(root.querySelector('#other')!.firstChild!, 0, text, 3);
    expect(endsTextSelection(clickOn(rowElement))).toBe(true);
  });

  it('is false without a selection, for a collapsed one and for one elsewhere in the document', () => {
    const root = host('<div id="row"><span id="cell">Alice</span></div><p id="other">Bob</p>');
    const rowElement = root.querySelector<HTMLElement>('#row')!;
    expect(endsTextSelection(clickOn(rowElement))).toBe(false);
    const selection = document.getSelection()!;
    selection.collapse(root.querySelector('#cell')!.firstChild!, 2);
    expect(endsTextSelection(clickOn(rowElement))).toBe(false);
    selection.selectAllChildren(root.querySelector('#other')!);
    expect(endsTextSelection(clickOn(rowElement))).toBe(false);
  });
});
