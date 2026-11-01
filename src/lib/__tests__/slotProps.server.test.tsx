// @vitest-environment node
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mergeSlotProps, type SlotPart } from '../slotProps';

/** A callback ref, as components pass theirs (the refs lint rejects a ref object here). */
const trackRef = (node: HTMLSpanElement | null) => void node;

function Track({ part }: { part?: SlotPart<'span'> }) {
  return (
    <span
      {...mergeSlotProps(part, {
        className: 'wave-switch__track',
        style: { inlineSize: 40 },
        ref: trackRef,
        defaults: { title: 'Track' },
        locked: { 'aria-hidden': true, onClick: () => {} },
      })}
    />
  );
}

describe('mergeSlotProps on the server (no DOM)', () => {
  it('renders the same markup for no part and an empty part', () => {
    expect(typeof window).toBe('undefined');
    const none = renderToString(<Track />);
    expect(renderToString(<Track part={{}} />)).toBe(none);
    expect(none).toBe(
      '<span title="Track" class="wave-switch__track" style="inline-size:40px" aria-hidden="true"></span>',
    );
  });

  it('renders the consumer props of a part', () => {
    const html = renderToString(
      <Track
        part={{
          className: 'mine',
          style: { color: 'blue' },
          title: 'Mine',
          'data-part': 'track',
          'aria-hidden': false,
          ref: React.createRef<HTMLSpanElement>(),
          onClick: () => {},
        }}
      />,
    );
    // The locked `aria-hidden` keeps its value; its attribute sits where the consumer's key was.
    expect(html).toBe(
      '<span title="Mine" data-part="track" aria-hidden="true" class="wave-switch__track mine" style="inline-size:40px;color:blue"></span>',
    );
  });
});
