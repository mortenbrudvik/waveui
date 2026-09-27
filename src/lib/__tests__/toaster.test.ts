import * as React from 'react';
import { createPortal } from 'react-dom';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { isToastOptions } from '../toaster';

describe('isToastOptions (P3-01, D12)', () => {
  it.each([
    ['an element', React.createElement('span', null, 'Saved')],
    ['a portal', createPortal(React.createElement('span'), document.createElement('div'))],
    ['a string', 'Saved'],
    ['a number', 42],
    ['an array', ['Saved']],
    ['a Set', new Set(['Saved'])],
    ['a Fragment', React.createElement(React.Fragment, null, 'Saved')],
    ['null', null],
    ['undefined', undefined],
    ['a thenable', Promise.resolve('Saved')],
    [
      'a generator',
      (function* lines() {
        yield 'Saved';
      })(),
    ],
    // A plain object (Object.prototype) that is also iterable: only the iterator check, not the
    // prototype check, excludes it. Pins that check on its own.
    [
      'a plain iterable',
      {
        *[Symbol.iterator](): Generator<string> {
          yield 'Saved';
        },
      },
    ],
    // A plain object (Object.prototype) that is also a thenable: only the `then` check excludes
    // it. Pins that check on its own.
    ['a plain thenable', { then: (resolve: (value: string) => void) => resolve('Saved') }],
    // A class instance: no `$$typeof`, not iterable, not a thenable, but its prototype is neither
    // `null` nor `Object.prototype` (and its prototype's prototype is `Object.prototype`, not
    // `null`). Only the prototype check excludes it; pins that check as a whole.
    [
      'a class instance',
      new (class Notice {
        title = 'Saved';
      })(),
    ],
  ])('reads %s as content', (_, value) => {
    expect(isToastOptions(value)).toBe(false);
  });

  it.each([
    ['a plain object', { title: 'Saved' }],
    [
      'an object without a prototype',
      Object.assign(Object.create(null) as object, { title: 'Saved' }),
    ],
    // A plain object from another realm: its prototype is that realm's `Object.prototype`, not
    // this realm's, so only the cross-realm clause (that prototype's own prototype is `null`)
    // reads it as options. Pins that clause on its own.
    ['an object from another realm', runInNewContext('({ title: "Saved" })') as unknown],
  ])('reads %s as options', (_, value) => {
    expect(isToastOptions(value)).toBe(true);
  });
});
