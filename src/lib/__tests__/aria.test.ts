import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { joinIds, focusableDisabledProps, preventIfDisabled } from '../aria';

describe('joinIds', () => {
  it('joins ids with a single space in order', () => {
    expect(joinIds('a', 'b', 'c')).toBe('a b c');
  });

  it('splits on whitespace and de-duplicates, keeping first occurrence order', () => {
    expect(joinIds('hint  error', 'error\ttooltip', 'hint')).toBe('hint error tooltip');
  });

  it('skips empty values', () => {
    expect(joinIds(undefined, null, false, '', '  ', 'x')).toBe('x');
  });

  it('returns undefined when nothing is left (so React drops the attribute)', () => {
    expect(joinIds()).toBeUndefined();
    expect(joinIds(undefined, '')).toBeUndefined();
  });
});

describe('focusableDisabledProps', () => {
  it('marks the control unavailable while keeping it focusable', () => {
    expect(focusableDisabledProps(true)).toEqual({ 'aria-disabled': true, 'data-disabled': '' });
  });

  it('adds nothing when enabled', () => {
    expect(focusableDisabledProps(false)).toEqual({});
    expect(focusableDisabledProps()).toEqual({});
  });

  it('renders aria-disabled + data-disabled and no native disabled attribute', () => {
    render(
      React.createElement('button', { type: 'button', ...focusableDisabledProps(true) }, 'Next'),
    );
    const button = screen.getByRole('button', { name: 'Next' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('data-disabled');
    expect(button).not.toBeDisabled();
    button.focus();
    expect(button).toHaveFocus();
  });
});

describe('preventIfDisabled', () => {
  it('calls the handler when enabled', () => {
    const handler = vi.fn();
    const event = { preventDefault: vi.fn() };
    preventIfDisabled(false, handler)(event);
    expect(handler).toHaveBeenCalledWith(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('prevents the default action and skips the handler when disabled', () => {
    const handler = vi.fn();
    const event = { preventDefault: vi.fn() };
    preventIfDisabled(true, handler)(event);
    expect(handler).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('blocks navigation of an aria-disabled link', () => {
    const onClick = vi.fn();
    const props: React.ComponentProps<'a'> = {
      href: '#next',
      ...focusableDisabledProps(true),
      onClick: preventIfDisabled(true, onClick),
    };
    render(React.createElement('a', props, 'Next page'));
    const link = screen.getByRole('link', { name: 'Next page' });
    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('works without a handler', () => {
    const event = { preventDefault: vi.fn() };
    expect(() => preventIfDisabled(false)(event)).not.toThrow();
    preventIfDisabled(true)(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});
