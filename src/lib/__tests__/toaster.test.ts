import * as React from 'react';
import { createPortal } from 'react-dom';
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
  ])('reads %s as content', (_, value) => {
    expect(isToastOptions(value)).toBe(false);
  });

  it.each([
    ['a plain object', { title: 'Saved' }],
    [
      'an object without a prototype',
      Object.assign(Object.create(null) as object, { title: 'Saved' }),
    ],
  ])('reads %s as options', (_, value) => {
    expect(isToastOptions(value)).toBe(true);
  });
});
