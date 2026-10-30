// @vitest-environment node
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getNativeElementProps } from '../nativeProps';

describe('getNativeElementProps on the server (no DOM)', () => {
  it('filters the props and renders them without a window', () => {
    expect(typeof window).toBe('undefined');
    const props = {
      id: 'a',
      className: 'c',
      appearance: 'primary',
      onValueChange: () => {},
      'data-state': 'open',
      href: '#x',
    };
    expect(renderToString(<a {...getNativeElementProps('a', props)}>x</a>)).toBe(
      '<a id="a" class="c" data-state="open" href="#x">x</a>',
    );
    expect(renderToString(<span {...getNativeElementProps('span', props)}>x</span>)).toBe(
      '<span id="a" class="c" data-state="open">x</span>',
    );
  });
});
