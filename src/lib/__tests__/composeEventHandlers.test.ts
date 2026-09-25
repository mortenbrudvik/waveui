import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { composeEventHandlers } from '../composeEventHandlers';

function fakeEvent() {
  return {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

describe('composeEventHandlers (layout#10)', () => {
  it('calls the consumer handler first, then the internal one', () => {
    const calls: string[] = [];
    const handler = composeEventHandlers(
      () => calls.push('theirs'),
      () => calls.push('ours'),
    );
    handler(fakeEvent());
    expect(calls).toEqual(['theirs', 'ours']);
  });

  it('skips the internal handler when the consumer calls preventDefault()', () => {
    const ours = vi.fn();
    const handler = composeEventHandlers(
      (e: ReturnType<typeof fakeEvent>) => e.preventDefault(),
      ours,
    );
    handler(fakeEvent());
    expect(ours).not.toHaveBeenCalled();
  });

  it('skips the internal handler when the event was already prevented upstream', () => {
    const theirs = vi.fn();
    const ours = vi.fn();
    const event = fakeEvent();
    event.preventDefault();
    composeEventHandlers(theirs, ours)(event);
    expect(theirs).toHaveBeenCalledTimes(1);
    expect(ours).not.toHaveBeenCalled();
  });

  it('runs the internal handler anyway with checkDefaultPrevented: false', () => {
    const ours = vi.fn();
    const handler = composeEventHandlers(
      (e: ReturnType<typeof fakeEvent>) => e.preventDefault(),
      ours,
      { checkDefaultPrevented: false },
    );
    handler(fakeEvent());
    expect(ours).toHaveBeenCalledTimes(1);
  });

  it('tolerates missing handlers', () => {
    const ours = vi.fn();
    const theirs = vi.fn();
    composeEventHandlers(undefined, ours)(fakeEvent());
    composeEventHandlers(theirs, undefined)(fakeEvent());
    expect(() => composeEventHandlers()(fakeEvent())).not.toThrow();
    expect(ours).toHaveBeenCalledTimes(1);
    expect(theirs).toHaveBeenCalledTimes(1);
  });

  it('passes the same event object to both handlers', () => {
    const seen: unknown[] = [];
    const event = fakeEvent();
    composeEventHandlers(
      (e) => seen.push(e),
      (e) => seen.push(e),
    )(event);
    expect(seen).toEqual([event, event]);
  });

  it('composes React synthetic events: a consumer onClick no longer disables built-in behaviour', () => {
    const internal = vi.fn();
    const consumer = vi.fn();
    function Tab({ onClick }: { onClick?: React.MouseEventHandler<HTMLButtonElement> }) {
      const props: React.ComponentProps<'button'> = {
        type: 'button',
        onClick: composeEventHandlers(onClick, internal),
      };
      return React.createElement('button', props, 'Tab');
    }
    render(React.createElement(Tab, { onClick: consumer }));
    fireEvent.click(screen.getByRole('button', { name: 'Tab' }));
    expect(consumer).toHaveBeenCalledTimes(1);
    expect(internal).toHaveBeenCalledTimes(1);
  });

  it('lets a consumer opt out of built-in behaviour with preventDefault on a synthetic event', () => {
    const internal = vi.fn();
    function Tab({ onKeyDown }: { onKeyDown?: React.KeyboardEventHandler<HTMLDivElement> }) {
      return React.createElement('div', {
        role: 'tablist',
        tabIndex: 0,
        onKeyDown: composeEventHandlers(onKeyDown, internal),
      });
    }
    render(
      React.createElement(Tab, { onKeyDown: (e) => e.key === 'ArrowRight' && e.preventDefault() }),
    );
    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(internal).not.toHaveBeenCalled();
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(internal).toHaveBeenCalledTimes(1);
  });

  it('infers a handler type usable as a React prop', () => {
    const consumer: React.MouseEventHandler<HTMLButtonElement> | undefined = undefined;
    const internal = (event: React.MouseEvent<HTMLButtonElement>) => event.currentTarget.focus();
    const composed = composeEventHandlers(consumer, internal);
    expectTypeOf(composed).toMatchTypeOf<React.MouseEventHandler<HTMLButtonElement>>();
    expectTypeOf(composed).parameter(0).toEqualTypeOf<React.MouseEvent<HTMLButtonElement>>();
  });
});
