// @vitest-environment node
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderSlot, resolveSlot } from '../slot';

describe('render-function slots on the server (no DOM)', () => {
  it('renders the element the function returns, with the merged props', () => {
    expect(typeof window).toBe('undefined');
    const html = renderToString(
      <p>
        {renderSlot(
          {
            className: 'mine',
            children: (Component, props) => (
              <Component {...props} data-own="">
                ★
              </Component>
            ),
          },
          'span',
          'base',
          { 'aria-hidden': true },
        )}
      </p>,
    );
    expect(html).toBe('<p><span aria-hidden="true" class="base mine" data-own="">★</span></p>');
  });

  it('renders a resolved slot with the props and children its renderer adds', () => {
    const { Component, props } = resolveSlot(
      { children: (Tag, own) => <Tag {...own} /> },
      'i',
      'base',
    )!;
    expect(renderToString(<Component {...props} title="Close" />)).toBe(
      '<i class="base" title="Close"></i>',
    );
  });
});
