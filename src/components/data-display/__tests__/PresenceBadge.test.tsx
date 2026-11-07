import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { presenceBadgeClassNames } from '../../../lib/classNames';
import { Avatar } from '../Avatar';
import { Persona } from '../Persona';
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
  'blocked',
  'unknown',
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
    ['blocked', 'Blocked'],
    ['unknown', 'Unknown'],
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
    ['blocked', 'slash'],
    ['unknown', 'question'],
  ] as Array<[PresenceStatus, string]>)('status "%s" draws the %s glyph', (status, glyph) => {
    render(<PresenceBadge status={status} />);
    const badge = screen.getByRole('img');
    expect(badge).toHaveAttribute('data-glyph', glyph);
    const svg = badge.querySelector('svg');
    // The icons keep their 0.12 names (`presence-dnd`, `presence-oof`).
    const icon = status === 'do-not-disturb' ? 'dnd' : status === 'out-of-office' ? 'oof' : status;
    expect(svg).toHaveAttribute('data-wave-icon', `presence-${icon}`);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('wave:size-full');
    expect(badge.querySelectorAll('svg')).toHaveLength(1);
  });

  // data-display#15: forced colors replace the background with Canvas, so the solid busy dot is
  // painted by the glyph (a filled disc in currentColor, forced to CanvasText) rather than by the
  // background alone.
  it('draws the busy dot with currentColor so it stays solid in forced-colors mode', () => {
    render(<PresenceBadge status="busy" />);
    const badge = screen.getByRole('img', { name: 'Busy' });
    expect(badge).toHaveClass('wave:text-presence-busy');
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
    ['available', ['wave:bg-presence-available', 'wave:text-presence-glyph']],
    ['busy', ['wave:bg-presence-busy', 'wave:text-presence-busy']],
    ['away', ['wave:bg-presence-away', 'wave:text-presence-glyph']],
    ['offline', ['wave:bg-background', 'wave:text-presence-offline']],
    ['do-not-disturb', ['wave:bg-presence-busy', 'wave:text-presence-glyph']],
    ['out-of-office', ['wave:bg-presence-oof', 'wave:text-presence-glyph']],
    ['blocked', ['wave:bg-presence-busy', 'wave:text-presence-glyph']],
    ['unknown', ['wave:bg-background', 'wave:text-presence-offline']],
  ] as Array<[PresenceStatus, string[]]>)('status "%s" uses %j', (status, classes) => {
    render(<PresenceBadge status={status} />);
    const badge = screen.getByRole('img');
    expect(badge).toHaveClass(...classes, 'wave:ring-2', 'wave:ring-background');
    expect(badge.className).not.toMatch(/white|#|grey|var\(/);
  });

  // data-display#16
  it.each([
    ['extra-small', 'wave:size-2'],
    ['small', 'wave:size-2.5'],
    ['medium', 'wave:size-3'],
    ['large', 'wave:size-4'],
    ['extra-large', 'wave:size-5'],
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
    expect(svg).toHaveClass('wave:wave-rtl:-scale-x-100');
    expect(svg).not.toHaveClass('wave:rtl:-scale-x-100');
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
    // Ruling BR: the 0.x names are no members of the type in 1.0, but server data and untyped code
    // still send them. The badge draws the new name (its look, `data-status` and name) and warns
    // once per old name in development; a bridge that may go in 2.0.
    const OLD_NAMES = [
      ['dnd', 'do-not-disturb', 'Do not disturb', 'bar'],
      ['oof', 'out-of-office', 'Out of office', 'arrow'],
    ] as const;
    const message = (old: string, current: string) =>
      `[WaveUI] PresenceBadge: status '${old}' was removed in 1.0; the badge draws '${current}' ` +
      `for it. Use '${current}': this fallback for server data and untyped code may be removed in 2.0.`;
    /** A status as untyped code passes it. */
    const untyped = (status: string) => status as PresenceStatus;

    it.each(OLD_NAMES)(
      "draws '%s' as '%s' (look, data-status and name) and warns once in development (StrictMode)",
      (old, current, label, glyph) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error');
        try {
          const { rerender } = render(
            <React.StrictMode>
              <PresenceBadge status={untyped(old)} />
            </React.StrictMode>,
          );
          rerender(
            <React.StrictMode>
              <PresenceBadge status={untyped(old)} size="large" />
            </React.StrictMode>,
          );
          const badge = screen.getByRole('img', { name: label });
          expect(badge).toHaveAttribute('data-status', current);
          expect(badge).toHaveAttribute('data-glyph', glyph);
          render(<PresenceBadge status={current} />);
          const expected = screen.getAllByRole('img', { name: label })[1];
          expect(badge.innerHTML).toBe(expected.innerHTML);
          expect(warn.mock.calls).toEqual([[message(old, current)]]);
          expect(error).not.toHaveBeenCalled();
        } finally {
          warn.mockRestore();
          error.mockRestore();
        }
      },
    );

    it('warns once for each old name, and never for the new names', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <>
            <PresenceBadge status={untyped('dnd')} />
            <PresenceBadge status={untyped('oof')} />
            <PresenceBadge status={untyped('dnd')} />
            <PresenceBadge status="do-not-disturb" />
            <PresenceBadge status="out-of-office" />
          </>,
        );
        expect(warn.mock.calls).toEqual([
          [message('dnd', 'do-not-disturb')],
          [message('oof', 'out-of-office')],
        ]);
      } finally {
        warn.mockRestore();
      }
    });

    it('draws the new name in production without a warning', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(<PresenceBadge status={untyped('oof')} />);
        expect(screen.getByRole('img', { name: 'Out of office' })).toHaveAttribute(
          'data-status',
          'out-of-office',
        );
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
        vi.unstubAllEnvs();
      }
    });

    it('renders an old name on the server as its new name, without throwing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const html = renderToString(<PresenceBadge status={untyped('dnd')} />);
        expect(html).toBe(renderToString(<PresenceBadge status="do-not-disturb" />));
        expect(html).toContain('data-status="do-not-disturb"');
        // Effects do not run on the server: the warning comes from the client.
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('reaches the badge through Persona and the badge slot of Avatar', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <>
            <Persona name="Jane Doe" status={untyped('dnd')} />
            <Avatar name="John Doe" badge={<PresenceBadge status={untyped('oof')} />} />
          </>,
        );
        expect(screen.getByRole('img', { name: 'Do not disturb' })).toHaveAttribute(
          'data-status',
          'do-not-disturb',
        );
        expect(screen.getByRole('img', { name: 'Out of office' })).toHaveAttribute(
          'data-status',
          'out-of-office',
        );
        expect(warn.mock.calls).toEqual([
          [message('dnd', 'do-not-disturb')],
          [message('oof', 'out-of-office')],
        ]);
      } finally {
        warn.mockRestore();
      }
    });

    describe('a value that is no status at all', () => {
      const unknownMessage = (value: string) =>
        `[WaveUI] PresenceBadge: status '${value}' is not a presence status; the badge draws ` +
        "'offline'. Use one of available, busy, away, offline, do-not-disturb, out-of-office, blocked, unknown.";

      it.each([['DND'], ['Busy '], ['constructor'], ['null']])(
        "draws %j as 'offline' instead of throwing, and warns once in development",
        (value) => {
          const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
          try {
            render(
              <React.StrictMode>
                <PresenceBadge status={untyped(value)} />
              </React.StrictMode>,
            );
            const badge = screen.getByRole('img', { name: 'Offline' });
            expect(badge).toHaveAttribute('data-status', 'offline');
            expect(warn.mock.calls).toEqual([[unknownMessage(value)]]);
          } finally {
            warn.mockRestore();
          }
        },
      );

      it('draws null as offline, and the same on the server', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
          const asNull = null as unknown as PresenceStatus;
          const html = renderToString(<PresenceBadge status={asNull} />);
          expect(html).toBe(renderToString(<PresenceBadge status="offline" />));
          render(<PresenceBadge status={asNull} />);
          expect(screen.getByRole('img', { name: 'Offline' })).toHaveAttribute(
            'data-status',
            'offline',
          );
          expect(warn.mock.calls).toEqual([[unknownMessage('null')]]);
        } finally {
          warn.mockRestore();
        }
      });

      it('draws offline in production without a warning', () => {
        vi.stubEnv('NODE_ENV', 'production');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
          render(<PresenceBadge status={untyped('DND')} />);
          expect(screen.getByRole('img', { name: 'Offline' })).toBeInTheDocument();
          expect(warn).not.toHaveBeenCalled();
        } finally {
          warn.mockRestore();
          vi.unstubAllEnvs();
        }
      });

      it('lets an error thrown by the warning itself surface', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
          throw new Error('console is strict');
        });
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
          expect(() => render(<PresenceBadge status={untyped('DND')} />)).toThrow(
            'console is strict',
          );
        } finally {
          warn.mockRestore();
          error.mockRestore();
        }
      });
    });

    it('keeps the old names out of the type', () => {
      // @ts-expect-error -- `'dnd'` is removed in 1.0: use `'do-not-disturb'`
      void (<PresenceBadge status="dnd" />);
      // @ts-expect-error -- `'oof'` is removed in 1.0: use `'out-of-office'`
      void (<Persona name="Jane Doe" status="oof" />);
    });

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
        | 'available'
        | 'busy'
        | 'away'
        | 'offline'
        | 'do-not-disturb'
        | 'out-of-office'
        | 'blocked'
        | 'unknown'
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
    `<svg aria-hidden="true" class="wave-presence-badge__icon wave:size-full wave:wave-rtl:-scale-x-100" data-wave-icon="presence-oof" ${GLYPH}>`,
    `<svg aria-hidden="true" class="wave-presence-badge__icon wave:size-full" data-wave-icon="presence-available" ${GLYPH}>`,
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
    expect(icon).not.toHaveClass('wave:size-full');
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
      'wave:wave-rtl:-scale-x-100',
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

describe('PresenceBadge — outOfOffice (presence-2)', () => {
  const OOF_TEXT: Array<[PresenceStatus, string]> = [
    ['available', 'wave:text-presence-available'],
    ['busy', 'wave:text-presence-busy'],
    ['away', 'wave:text-presence-away'],
    ['offline', 'wave:text-presence-offline'],
    ['do-not-disturb', 'wave:text-presence-busy'],
    ['blocked', 'wave:text-presence-busy'],
    ['unknown', 'wave:text-presence-offline'],
  ];

  it.each(OOF_TEXT)(
    'status "%s" with outOfOffice draws the arrow in its own color on the page color',
    (status, textClass) => {
      render(<PresenceBadge status={status} outOfOffice />);
      const badge = screen.getByRole('img');
      expect(badge).toHaveAttribute('data-glyph', 'arrow');
      expect(badge).toHaveAttribute('data-status', status);
      expect(badge).toHaveAttribute('data-out-of-office', '');
      expect(badge).toHaveClass('wave:bg-background', textClass, 'wave:ring-2');
      expect(badge.querySelector('svg')).toHaveAttribute('data-wave-icon', 'presence-oof');
      expect(badge.querySelector('svg')).toHaveClass('wave:wave-rtl:-scale-x-100');
      expect(badge.querySelectorAll('svg')).toHaveLength(1);
    },
  );

  it.each(OOF_TEXT)('status "%s" with outOfOffice keeps its name and adds the state', (status) => {
    const { unmount } = render(<PresenceBadge status={status} />);
    const plain = screen.getByRole('img').getAttribute('aria-label');
    unmount();
    render(<PresenceBadge status={status} outOfOffice />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', `${plain}, out of office`);
  });

  it('is the same look and name as the out-of-office status itself', () => {
    const { unmount } = render(<PresenceBadge status="out-of-office" />);
    const plain = screen.getByRole('img').outerHTML.replace(' data-out-of-office=""', '');
    unmount();
    render(<PresenceBadge status="out-of-office" outOfOffice />);
    const flagged = screen.getByRole('img');
    expect(flagged).toHaveAttribute('aria-label', 'Out of office');
    expect(flagged).toHaveClass('wave:bg-presence-oof');
    expect(flagged.outerHTML.replace(' data-out-of-office=""', '')).toBe(plain);
  });

  it('is off by default, with no attribute and the status look', () => {
    render(<PresenceBadge status="available" />);
    const badge = screen.getByRole('img');
    expect(badge).not.toHaveAttribute('data-out-of-office');
    expect(badge).toHaveAttribute('data-glyph', 'check');
  });

  it('a consumer aria-label still replaces the name', () => {
    render(<PresenceBadge status="busy" outOfOffice aria-label="Away from the office until May" />);
    expect(screen.getByRole('img', { name: 'Away from the office until May' })).toBeInTheDocument();
  });

  it('does not reach the element as an attribute', () => {
    render(<PresenceBadge outOfOffice />);
    expect(screen.getByRole('img')).not.toHaveAttribute('outofoffice');
    expect(screen.getByRole('img')).not.toHaveAttribute('outOfOffice');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <>
        {OOF_TEXT.map(([status]) => (
          <PresenceBadge key={status} status={status} outOfOffice />
        ))}
      </>,
    );
    await expectNoA11yViolations(container);
  });
});
