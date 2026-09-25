import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { mergeProps } from '../mergeProps';

const STATE_ARIA = ['aria-expanded', 'aria-controls', 'aria-haspopup'] as const;

describe('mergeProps', () => {
  it('lets theirs win for plain keys and keeps keys only one side has', () => {
    const merged = mergeProps(
      { id: 'ours', role: 'button', tabIndex: 0 },
      { id: 'theirs', title: 'Hi' },
    );
    expect(merged).toEqual({ id: 'theirs', role: 'button', tabIndex: 0, title: 'Hi' });
  });

  it('ignores undefined values from theirs', () => {
    const theirs: { type?: string; id?: string } = { type: undefined, id: undefined };
    const merged = mergeProps({ type: 'button', id: 'ours' }, theirs);
    expect(merged.type).toBe('button');
    expect(merged.id).toBe('ours');
  });

  it('does not mutate its inputs', () => {
    const ours = { className: 'a', style: { color: 'red' } };
    const theirs = { className: 'b', style: { margin: 0 } };
    mergeProps(ours, theirs);
    expect(ours).toEqual({ className: 'a', style: { color: 'red' } });
    expect(theirs).toEqual({ className: 'b', style: { margin: 0 } });
  });

  describe('event handlers', () => {
    it('composes on* handlers, theirs first', () => {
      const calls: string[] = [];
      type Handler = (event: { defaultPrevented: boolean }) => void;
      const ours: Handler = () => calls.push('ours');
      const theirs: Handler = () => calls.push('theirs');
      const merged = mergeProps({ onClick: ours }, { onClick: theirs });
      merged.onClick({ defaultPrevented: false });
      expect(calls).toEqual(['theirs', 'ours']);
    });

    it('skips ours when theirs prevents the default', () => {
      const ours = vi.fn();
      const merged = mergeProps(
        { onKeyDown: ours },
        { onKeyDown: (e: { preventDefault(): void }) => e.preventDefault() },
      );
      const event = {
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };
      merged.onKeyDown(event);
      expect(ours).not.toHaveBeenCalled();
    });

    it('keeps a handler that only one side defines', () => {
      const ours = vi.fn();
      const theirs = vi.fn();
      const theirProps: { onFocus?: () => void; onClick?: () => void } = {
        onFocus: theirs,
        onClick: undefined,
      };
      const merged = mergeProps({ onClick: ours }, theirProps);
      expect(merged.onClick).toBe(ours);
      expect(merged.onFocus).toBe(theirs);
    });

    it('does not treat non-handler keys that start with "on" as handlers', () => {
      const merged = mergeProps({ one: 'a' }, { one: 'b' });
      expect(merged.one).toBe('b');
    });
  });

  it('merges className with cn (theirs win conflicts)', () => {
    const merged = mergeProps(
      { className: 'px-4 text-body-1 text-foreground' },
      { className: 'px-2 text-primary' },
    );
    expect(merged.className).toBe('text-body-1 px-2 text-primary');
  });

  it('shallow-merges style (theirs win per property)', () => {
    const merged = mergeProps(
      { style: { color: 'red', margin: 4 } },
      { style: { color: 'blue', padding: 2 } },
    );
    expect(merged.style).toEqual({ color: 'blue', margin: 4, padding: 2 });
  });

  it('joins aria-describedby and aria-labelledby (theirs first, de-duplicated)', () => {
    const merged = mergeProps(
      { 'aria-describedby': 'tooltip-1', 'aria-labelledby': 'label-1' },
      { 'aria-describedby': 'hint-1 tooltip-1', 'aria-labelledby': 'own-label' },
    );
    expect(merged['aria-describedby']).toBe('hint-1 tooltip-1');
    expect(merged['aria-labelledby']).toBe('own-label label-1');
  });

  it('merges refs so both receive the node', () => {
    const ours = React.createRef<HTMLButtonElement>();
    const theirs = vi.fn();
    const props = mergeProps({ ref: ours, type: 'button' as const }, { ref: theirs });
    render(React.createElement('button', props, 'Go'));
    const button = screen.getByRole('button', { name: 'Go' });
    expect(ours.current).toBe(button);
    expect(theirs).toHaveBeenCalledWith(button);
  });

  describe('oursWin', () => {
    it('keeps our live state ARIA over a child’s static attribute', () => {
      const merged = mergeProps(
        { 'aria-expanded': true, 'aria-haspopup': 'dialog', 'aria-controls': 'popup-1' },
        { 'aria-expanded': false, 'aria-haspopup': 'menu', 'aria-controls': 'other', id: 'mine' },
        { oursWin: STATE_ARIA },
      );
      expect(merged['aria-expanded']).toBe(true);
      expect(merged['aria-haspopup']).toBe('dialog');
      expect(merged['aria-controls']).toBe('popup-1');
      expect(merged.id).toBe('mine');
    });

    it('keeps our explicit undefined (aria-controls only while open)', () => {
      const merged = mergeProps(
        { 'aria-expanded': false, 'aria-controls': undefined },
        { 'aria-controls': 'stale' },
        { oursWin: STATE_ARIA },
      );
      expect(merged['aria-controls']).toBeUndefined();
      expect('aria-controls' in merged).toBe(true);
    });

    it('lets theirs fill an oursWin key that ours does not define', () => {
      const merged = mergeProps(
        { 'aria-expanded': true },
        { 'aria-haspopup': 'listbox' },
        {
          oursWin: STATE_ARIA,
        },
      );
      expect(merged['aria-haspopup']).toBe('listbox');
    });
  });

  it('works end-to-end on a rendered element', () => {
    const internal = vi.fn();
    const consumer = vi.fn();
    const props = mergeProps(
      { type: 'button' as const, className: 'px-4', onClick: internal, 'aria-expanded': false },
      { className: 'px-2', onClick: consumer, 'aria-expanded': true },
      { oursWin: STATE_ARIA },
    );
    render(React.createElement('button', props, 'Menu'));
    const button = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(button);
    expect(consumer).toHaveBeenCalledTimes(1);
    expect(internal).toHaveBeenCalledTimes(1);
    expect(button.className).toBe('px-2');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('merges a consumer <button> slot into a wired dismiss button without nesting (C-SLOTS)', () => {
    const onDismiss = vi.fn();
    const consumerClick = vi.fn();
    const slot = React.createElement(
      'button',
      { type: 'submit', onClick: consumerClick, className: 'text-primary' },
      '×',
    );
    const { children, ...slotProps } = slot.props as React.ComponentProps<'button'>;
    const wired: React.ComponentProps<'button'> = {
      type: 'button',
      'aria-label': 'Dismiss',
      className: 'rounded text-muted-foreground',
      onClick: onDismiss,
    };
    render(React.createElement('button', mergeProps(wired, slotProps), children));
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(consumerClick).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(buttons[0].className).toBe('rounded text-primary');
  });
});
