import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import * as React from 'react';
import { useMediaQuery } from '../useMediaQuery';
import { mockMatchMedia } from '../../test-utils';

const QUERY = '(min-width: 100px)';

describe('useMediaQuery', () => {
  it('reflects a matching query', () => {
    mockMatchMedia({ [QUERY]: true });
    const { result } = renderHook(() => useMediaQuery(QUERY));
    expect(result.current).toBe(true);
  });

  it('is false while the query does not match', () => {
    mockMatchMedia({ [QUERY]: false });
    const { result } = renderHook(() => useMediaQuery(QUERY));
    expect(result.current).toBe(false);
  });

  it('reacts to a change event', () => {
    mockMatchMedia({ [QUERY]: false });
    const { result } = renderHook(() => useMediaQuery(QUERY));
    expect(result.current).toBe(false);

    mockMatchMedia({ [QUERY]: true });
    expect(result.current).toBe(true);
  });

  it('is false on the server, whatever the client would answer', () => {
    mockMatchMedia({ [QUERY]: true });
    function Probe() {
      return <span>{String(useMediaQuery(QUERY))}</span>;
    }
    expect(renderToString(<Probe />)).toContain('false');
  });
});
