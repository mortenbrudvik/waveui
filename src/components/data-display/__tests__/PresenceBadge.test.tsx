import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { presenceBadgeClassNames } from '../../../lib/classNames';
import { PresenceBadge } from '../PresenceBadge';
import type { PresenceBadgeProps } from '../PresenceBadge';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  openingTags,
  renderWithProviders,
  testSystemProps,
} from '../../../test-utils';
import type { PresenceStatus, Size } from '../../../lib/types';
import type * as Wave from '../../../index';

const STATUSES: PresenceStatus[] = [
  'available',
  'busy',
  'away',
  'offline',
  'do-not-disturb',
  'out-of-office',
];

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
    ['do-not-disturb', 'Do not disturb'],
    ['out-of-office', 'Out of office'],
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
    ['do-not-disturb', 'bar'],
    ['out-of-office', 'arrow'],
  ] as Array<[PresenceStatus, string]>)('status "%s" draws the %s glyph', (status, glyph) => {
    render(<PresenceBadge status={status} />);
    const badge = screen.getByRole('img');
    expect(badge).toHaveAttribute('data-glyph', glyph);
    const svg = badge.querySelector('svg');
    // The icons keep their 0.12 names (`presence-dnd`, `presence-oof`).
    const icon = status === 'do-not-disturb' ? 'dnd' : status === 'out-of-office' ? 'oof' : status;
    expect(svg).toHaveAttribute('data-wave-icon', `presence-${icon}`);
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
    ['do-not-disturb', ['bg-presence-busy', 'text-presence-glyph']],
    ['out-of-office', ['bg-presence-oof', 'text-presence-glyph']],
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

  // C-LOGICAL: Wave's `wave-rtl:` follows the element's own direction, so an LTR subtree of an RTL
  // page keeps the arrow unmirrored (Tailwind's `rtl:` also matches `[dir=rtl] *`). The variant's
  // CSS is checked by the styles build; jsdom asserts the class.
  it('mirrors the out-of-office arrow in right-to-left layouts with the wave-rtl variant', () => {
    renderWithProviders(
      <div dir="ltr">
        <PresenceBadge status="out-of-office" />
      </div>,
      { dir: 'rtl' },
    );
    const svg = screen.getByRole('img', { name: 'Out of office' }).querySelector('svg')!;
    expect(svg).toHaveClass('wave-rtl:-scale-x-100');
    expect(svg).not.toHaveClass('rtl:-scale-x-100');
  });

  it('mirrors no other status glyph', () => {
    for (const status of STATUSES.filter((s) => s !== 'out-of-office')) {
      const { unmount } = render(<PresenceBadge status={status} />);
      expect(screen.getByRole('img').querySelector('svg')!.getAttribute('class')).not.toMatch(
        /scale-x/,
      );
      unmount();
    }
  });

  // button-provider#27 (C-REF): ref is declared in the props interface.
  it('declares ref in PresenceBadgeProps (C-REF)', () => {
    expectTypeOf<PresenceBadgeProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
  });

  describe('Fluent status names (0.13)', () => {
    // Removed in 1.0: like any status outside the union (untyped code), the 0.5 spellings have no
    // look of their own, and rendering one throws (no badge is drawn for a status it cannot name).
    it.each(['dnd', 'oof'] as const)(
      'has no %s alias (removed in 1.0): rendering it throws, with no warning',
      (alias) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error');
        try {
          // @ts-expect-error -- `'dnd'` and `'oof'` are removed in 1.0: use `'do-not-disturb'`
          // and `'out-of-office'`
          expect(() => render(<PresenceBadge status={alias} />)).toThrow(TypeError);
          expect(warn).not.toHaveBeenCalled();
          expect(error).not.toHaveBeenCalled();
        } finally {
          warn.mockRestore();
          error.mockRestore();
        }
      },
    );

    it('status is optional and defaults to available', () => {
      render(<PresenceBadge />);
      expect(screen.getByRole('img', { name: 'Available' })).toHaveAttribute(
        'data-status',
        'available',
      );
    });

    it('types the Fluent names and the optional status; no aliases (removed in 1.0)', () => {
      expectTypeOf<PresenceBadgeProps['status']>().toEqualTypeOf<PresenceStatus | undefined>();
      expectTypeOf<PresenceStatus>().toEqualTypeOf<
        'available' | 'busy' | 'away' | 'offline' | 'do-not-disturb' | 'out-of-office'
      >();
      expectTypeOf<'dnd'>().not.toExtend<PresenceStatus>();
      expectTypeOf<'oof'>().not.toExtend<PresenceStatus>();
      // @ts-expect-error -- `DeprecatedPresenceStatus` is removed in 1.0 (no member of the entry)
      expectTypeOf<Wave.DeprecatedPresenceStatus>().toBeAny();
    });
  });
});

describe('PresenceBadge — slotProps', () => {
  type BadgeSlotProps = NonNullable<PresenceBadgeProps['slotProps']>;
  const icons = (root: ParentNode = document) =>
    Array.from(root.querySelectorAll<SVGSVGElement>(`.${presenceBadgeClassNames.icon}`));

  // Captured from 112d7f8's dist (client and server agree).
  const GLYPH =
    'fill="none" focusable="false" height="100%" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 16 16" width="100%" xmlns="http://www.w3.org/2000/svg"';
  const BASE_PINS = [
    `<svg aria-hidden="true" class="wave-presence-badge__icon size-full wave-rtl:-scale-x-100" data-wave-icon="presence-oof" ${GLYPH}>`,
    `<svg aria-hidden="true" class="wave-presence-badge__icon size-full" data-wave-icon="presence-available" ${GLYPH}>`,
  ].join('\n');
  const Badges = ({ parts }: { parts?: BadgeSlotProps }) => (
    <>
      <PresenceBadge status="out-of-office" slotProps={parts} />
      <PresenceBadge status="available" size="large" slotProps={parts} />
    </>
  );

  it('renders the glyph of 112d7f8 (attributes sorted), on the client and the server', () => {
    for (const parts of [undefined, { icon: {} }]) {
      const view = render(<Badges parts={parts} />);
      expect(openingTags(...icons())).toBe(BASE_PINS);
      view.unmount();
      const template = document.createElement('template');
      template.innerHTML = renderToString(<Badges parts={parts} />);
      expect(openingTags(...icons(template.content))).toBe(BASE_PINS);
    }
  });

  it('renders the same markup without slotProps, with {} and with the part empty', () => {
    expectInertSlotProps((parts: BadgeSlotProps | undefined) => <Badges parts={parts} />, {
      icon: {},
    });
  });

  it('puts your className, style, data-* and ref on the glyph', () => {
    const ref = React.createRef<SVGSVGElement>();
    render(
      <PresenceBadge
        status="away"
        slotProps={{
          icon: { className: 'my-icon size-2', style: { opacity: 0.5 }, 'data-part': 'icon', ref },
        }}
      />,
    );
    const [icon] = icons();
    expect(icon.classList[0]).toBe(presenceBadgeClassNames.icon);
    expect(icon).toHaveClass('my-icon', 'size-2');
    // Your class replaces a conflicting one of the part.
    expect(icon).not.toHaveClass('size-full');
    expect(icon).toHaveAttribute('data-part', 'icon');
    expect(icon).toHaveStyle({ opacity: '0.5' });
    expect(ref.current).toBe(icon);
    // The badge takes none of it.
    expect(screen.getByRole('img', { name: 'Away' })).not.toHaveClass('my-icon');
  });

  it('keeps the glyph decorative, and the badge its name', () => {
    const attempt = {
      role: 'img',
      tabIndex: 0,
      'aria-hidden': false,
      focusable: 'true',
    } as unknown as BadgeSlotProps['icon'];
    render(<PresenceBadge status="busy" slotProps={{ icon: attempt }} />);
    const [icon] = icons();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('focusable', 'false');
    expect(icon).not.toHaveAttribute('role');
    expect(icon).not.toHaveAttribute('tabindex');
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img')).toHaveAccessibleName('Busy');
  });

  it('keeps the mirrored glyph of out of office in right-to-left layouts', () => {
    renderWithProviders(
      <PresenceBadge status="out-of-office" slotProps={{ icon: { className: 'my-icon' } }} />,
      { dir: 'rtl' },
    );
    expect(icons()[0]).toHaveClass(
      presenceBadgeClassNames.icon,
      'wave-rtl:-scale-x-100',
      'my-icon',
    );
  });

  it('calls a handler of the glyph once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <React.StrictMode>
        <PresenceBadge status="available" slotProps={{ icon: { onClick } }} />
      </React.StrictMode>,
    );
    await user.click(icons()[0]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations with the part customised', async () => {
    render(
      <PresenceBadge status="away" slotProps={{ icon: { className: 'my-icon', id: 'glyph' } }} />,
    );
    await expectNoA11yViolations();
  });

  it('types the part for its element, and takes no children', () => {
    expectTypeOf<keyof BadgeSlotProps>().toEqualTypeOf<'icon'>();
    expectTypeOf<NonNullable<BadgeSlotProps['icon']>['ref']>().toEqualTypeOf<
      React.Ref<SVGSVGElement> | undefined
    >();
    // @ts-expect-error -- the badge draws the glyph's content
    const parts: BadgeSlotProps = { icon: { children: 'x' } };
    expect(parts).toBeDefined();
  });
});
