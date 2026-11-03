import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRovingTabIndex } from '../useRovingTabIndex';

/*
 * The 0.4 call shape `useRovingTabIndex(containerRef, options)` is removed in 1.0 (announced in
 * 0.18): the hook takes the options object alone, and the container is found through
 * `containerProps.ref`. TypeScript rejects the second argument. Untyped code that still passes it
 * gets no guard and no warning: the ref object is read as the options (every option at its
 * default) and the options are ignored, so the hook never learns the container.
 */

const OPTIONS = { items: ['a', 'b'], activeValue: 'b' };

function Positional({ onFocusMove }: { onFocusMove?: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const options = { ...OPTIONS, onFocusMove };
  // @ts-expect-error -- `useRovingTabIndex(containerRef, options)` is removed in 1.0
  const { handleKeyDown, getTabIndex } = useRovingTabIndex(ref, options);
  return (
    <div ref={ref} role="group" aria-label="Group" onKeyDown={handleKeyDown}>
      {OPTIONS.items.map((value) => (
        <button key={value} type="button" data-roving-value={value} tabIndex={getTabIndex(value)}>
          {value}
        </button>
      ))}
    </div>
  );
}

describe('useRovingTabIndex has no positional form (removed in 1.0)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('untyped code: the options are ignored, no item holds the tab stop, and nothing is logged', () => {
    const onFocusMove = vi.fn();
    render(<Positional onFocusMove={onFocusMove} />);
    // `activeValue: 'b'` never reaches the hook, and without the container no item is the stop.
    for (const name of ['a', 'b']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('tabindex', '-1');
    }
    // The key handler still works on the element it is attached to, with the default options.
    const a = screen.getByRole('button', { name: 'a' });
    act(() => a.focus());
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'b' })).toHaveFocus();
    expect(onFocusMove).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('the options form gives the same group its tab stop', () => {
    function Options() {
      const { containerProps, getTabIndex } = useRovingTabIndex(OPTIONS);
      return (
        <div role="group" aria-label="Group" {...containerProps}>
          {OPTIONS.items.map((value) => (
            <button
              key={value}
              type="button"
              data-roving-value={value}
              tabIndex={getTabIndex(value)}
            >
              {value}
            </button>
          ))}
        </div>
      );
    }
    render(<Options />);
    expect(screen.getByRole('button', { name: 'a' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: 'b' })).toHaveAttribute('tabindex', '0');
    expect(warn).not.toHaveBeenCalled();
  });
});
