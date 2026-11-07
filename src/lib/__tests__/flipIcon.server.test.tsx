// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { flipIconInRtl } from '../flipIcon';
import { ChevronRightIcon } from '../icons';

describe('flipIconInRtl and the icons on the server (no DOM)', () => {
  it('writes the mirroring class into the markup', () => {
    expect(typeof window).toBe('undefined');
    expect(renderToString(flipIconInRtl(<span className="x" />))).toBe(
      '<span class="x wave:wave-rtl:-scale-x-100"></span>',
    );
    expect(renderToString(<ChevronRightIcon flipInRtl />)).toContain(
      'class="wave:wave-rtl:-scale-x-100"',
    );
  });
});
