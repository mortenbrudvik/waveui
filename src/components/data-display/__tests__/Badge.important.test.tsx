import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Badge } from '../Badge';
import { CounterBadge } from '../CounterBadge';
import type { BadgeColor } from '../../../lib/types';

/*
 * P13-03: `color="important"` changes meaning in 1.0 (neutral, high emphasis), so Badge and
 * CounterBadge announce it in development: once, from an effect, with their own message (it is a
 * change of meaning, not a removal).
 */

const message = (name: string) =>
  `[WaveUI] ${name}: color="important" changes meaning in 1.0 (neutral, high emphasis); pass color="brand" or color="informative" to keep a coloured badge.`;

const cases: Array<[string, (color?: BadgeColor) => React.ReactElement]> = [
  ['Badge', (color) => <Badge color={color}>Text</Badge>],
  ['CounterBadge', (color) => <CounterBadge count={3} color={color} />],
];

describe.each(cases)('%s color="important" (P13-03)', (name, element) => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('warns once, with its own message, across rerenders and instances', () => {
    const ui = (
      <>
        {element('important')}
        {element('important')}
      </>
    );
    const { rerender } = render(ui);
    rerender(ui);
    expect(warn.mock.calls).toEqual([[message(name)]]);
  });

  it('logs nothing while rendering on the server (the warning comes from an effect)', () => {
    renderToString(element('important'));
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs nothing in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(element('important'));
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(['brand', 'informative', undefined] as const)(
    'logs nothing for the supported color %s',
    (color) => {
      render(element(color));
      expect(warn).not.toHaveBeenCalled();
    },
  );
});
