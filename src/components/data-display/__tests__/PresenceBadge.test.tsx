import type * as React from 'react';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresenceBadge } from '../PresenceBadge';
import type { PresenceBadgeProps } from '../PresenceBadge';
import { testSystemProps } from '../../../test-utils';
import type { PresenceStatus, Size } from '../../../lib/types';

const STATUSES: PresenceStatus[] = ['available', 'busy', 'away', 'offline', 'dnd', 'oof'];

describe('PresenceBadge', () => {
  testSystemProps(PresenceBadge, {
    expectedTag: 'span',
    displayName: 'PresenceBadge',
    defaultProps: { status: 'available' },
    a11yVariants: STATUSES.map((status) => ({ name: status, props: { status } })),
  });

  // data-display#15: a named image (not a live region), one per status.
  it.each([
    ['available', 'Available'],
    ['busy', 'Busy'],
    ['away', 'Away'],
    ['offline', 'Offline'],
    ['dnd', 'Do not disturb'],
    ['oof', 'Out of office'],
  ] as Array<[PresenceStatus, string]>)(
    'renders status "%s" as an image named "%s"',
    (status, label) => {
      render(<PresenceBadge status={status} />);
      expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
      expect(screen.queryByRole('status')).toBeNull();
    },
  );

  // data-display#15: status is not conveyed by color alone. The glyphs are the shared presence
  // icons of src/lib/icons.tsx (§5.7), sized to fill the badge.
  it.each([
    ['available', 'check'],
    ['busy', 'solid'],
    ['away', 'clock'],
    ['offline', 'ring-x'],
    ['dnd', 'bar'],
    ['oof', 'arrow'],
  ] as Array<[PresenceStatus, string]>)('status "%s" draws the %s glyph', (status, glyph) => {
    render(<PresenceBadge status={status} />);
    const badge = screen.getByRole('img');
    expect(badge).toHaveAttribute('data-glyph', glyph);
    const svg = badge.querySelector('svg');
    expect(svg).toHaveAttribute('data-wave-icon', `presence-${status}`);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('size-full');
    expect(badge.querySelectorAll('svg')).toHaveLength(1);
  });

  // data-display#15: forced colors replace the background with Canvas, so the solid busy dot is
  // painted by the glyph (a filled disc in currentColor, forced to CanvasText) rather than by the
  // background alone.
  it('draws the busy dot with currentColor so it stays solid in forced-colors mode', () => {
    render(<PresenceBadge status="busy" />);
    const badge = screen.getByRole('img', { name: 'Busy' });
    expect(badge).toHaveClass('text-presence-busy');
    const svg = badge.querySelector('svg');
    expect(svg).toHaveAttribute('data-wave-icon', 'presence-busy');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg).not.toHaveAttribute('stroke');
  });

  it('gives every status a distinct shape (busy and do not disturb differ)', () => {
    const glyphs = STATUSES.map((status) => {
      const { unmount } = render(<PresenceBadge status={status} />);
      const glyph = screen.getByRole('img').getAttribute('data-glyph');
      const markup = screen.getByRole('img').innerHTML;
      unmount();
      return `${glyph}|${markup}`;
    });
    expect(new Set(glyphs).size).toBe(STATUSES.length);
  });

  // data-display#15 / input-basic#8: presence tokens and a background-colored ring.
  it.each([
    ['available', ['bg-presence-available', 'text-presence-glyph']],
    ['busy', ['bg-presence-busy', 'text-presence-busy']],
    ['away', ['bg-presence-away', 'text-presence-glyph']],
    ['offline', ['bg-background', 'text-presence-offline']],
    ['dnd', ['bg-presence-busy', 'text-presence-glyph']],
    ['oof', ['bg-presence-oof', 'text-presence-glyph']],
  ] as Array<[PresenceStatus, string[]]>)('status "%s" uses %j', (status, classes) => {
    render(<PresenceBadge status={status} />);
    const badge = screen.getByRole('img');
    expect(badge).toHaveClass(...classes, 'ring-2', 'ring-background');
    expect(badge.className).not.toMatch(/white|#|grey|var\(/);
  });

  // data-display#16
  it.each([
    ['extra-small', 'size-2'],
    ['small', 'size-2.5'],
    ['medium', 'size-3'],
    ['large', 'size-4'],
    ['extra-large', 'size-5'],
  ] as Array<[Size, string]>)('size %s renders %s', (size, sizeClass) => {
    render(<PresenceBadge status="available" size={size} />);
    expect(screen.getByRole('img')).toHaveClass(sizeClass);
  });

  it('lets a consumer aria-label replace the default status name', () => {
    render(<PresenceBadge status="busy" aria-label="Busy until 3 PM" />);
    expect(screen.getByRole('img', { name: 'Busy until 3 PM' })).toBeInTheDocument();
  });

  it('mirrors the out-of-office arrow in right-to-left layouts', () => {
    render(<PresenceBadge status="oof" />);
    expect(screen.getByRole('img').querySelector('svg')).toHaveClass('rtl:-scale-x-100');
  });

  // button-provider#27 (C-REF): ref is declared in the props interface.
  it('declares ref in PresenceBadgeProps (C-REF)', () => {
    expectTypeOf<PresenceBadgeProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
  });
});
