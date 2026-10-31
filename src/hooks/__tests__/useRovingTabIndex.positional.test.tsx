import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useRovingTabIndex } from '../useRovingTabIndex';

/*
 * P13-03: the 0.4 call shape `useRovingTabIndex(containerRef, options)` is announced in
 * development, once, from an effect. The options-object form stays silent.
 */

const MESSAGE =
  '[WaveUI] useRovingTabIndex: `useRovingTabIndex(containerRef, options)` is deprecated and will be removed in 1.0. Use `useRovingTabIndex(options)` instead. Attach the returned `containerProps` to the container.';

function Positional() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { handleKeyDown } = useRovingTabIndex(ref, { items: ['a'], activeValue: 'a' });
  return <div ref={ref} role="group" onKeyDown={handleKeyDown} />;
}

function Modern() {
  const { containerProps } = useRovingTabIndex({ items: ['a'], activeValue: 'a' });
  return <div role="group" {...containerProps} />;
}

describe('useRovingTabIndex positional arguments (P13-03)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('warns once across rerenders and instances', () => {
    const ui = (
      <>
        <Positional />
        <Positional />
      </>
    );
    const { rerender } = render(ui);
    rerender(ui);
    expect(warn.mock.calls).toEqual([[MESSAGE]]);
  });

  it('logs nothing while rendering on the server (the warning comes from an effect)', () => {
    renderToString(<Positional />);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs nothing in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<Positional />);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs nothing for the options-object form', () => {
    render(<Modern />);
    renderHook(() => useRovingTabIndex({ items: ['a'] }));
    expect(warn).not.toHaveBeenCalled();
  });
});
