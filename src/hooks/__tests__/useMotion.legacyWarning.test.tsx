import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useLegacyMotionWarning } from '../useMotion';

/*
 * P13-03: a part whose `className` holds a presence variant and which has no `motion` loses its
 * default motion (0.14's rule, removed in 1.0). The hook announces it once per part, in
 * development, from an effect. Each part's own wiring is asserted in its motion test file.
 */

const LEGACY = 'p-4 data-[presence=exiting]:opacity-0';

const message = (part: string) =>
  `[WaveUI] ${part}: a className containing "[presence=" turns the default motion off; this compatibility rule is removed in 1.0 - pass the motion prop instead.`;

function Part({
  part = 'Dialog.Content',
  motion,
  className,
}: {
  part?: string;
  motion?: string | null;
  className?: string;
}) {
  useLegacyMotionWarning(part, motion, className);
  return null;
}

describe('useLegacyMotionWarning (P13-03)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('warns once per part across rerenders and instances', () => {
    const ui = (
      <>
        <Part className={LEGACY} />
        <Part className={LEGACY} />
        <Part part="Drawer" className={LEGACY} />
      </>
    );
    const { rerender } = render(ui);
    rerender(ui);
    expect(warn.mock.calls).toEqual([[message('Dialog.Content')], [message('Drawer')]]);
  });

  it('logs nothing while rendering on the server (the warning comes from an effect)', () => {
    renderToString(<Part className={LEGACY} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs nothing in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<Part className={LEGACY} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['no className', undefined, undefined],
    ['a className without a presence variant', undefined, 'p-4 data-[state=open]:opacity-100'],
    ['an explicit motion', 'my-motion', LEGACY],
    ['motion null', null, LEGACY],
  ] as const)('logs nothing for %s', (_name, motion, className) => {
    renderHook(() => useLegacyMotionWarning('Dialog.Content', motion, className));
    expect(warn).not.toHaveBeenCalled();
  });
});
