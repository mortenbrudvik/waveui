import type * as React from 'react';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CounterBadge } from '../CounterBadge';
import type { CounterBadgeProps } from '../CounterBadge';
import { badgeColorClasses } from '../Badge.colors';
import { expectNoA11yViolations, renderWithProviders, testSystemProps } from '../../../test-utils';
import type { BadgeColor } from '../../../lib/types';
import type { WaveTheme } from '../../../lib/theme';

type CounterBadgeAppearance = NonNullable<CounterBadgeProps['appearance']>;

const COLORS: BadgeColor[] = [
  'brand',
  'success',
  'warning',
  'danger',
  'important',
  'informative',
  'severe',
  'subtle',
];
const APPEARANCES: CounterBadgeAppearance[] = ['filled', 'outline'];
const THEMES: WaveTheme[] = ['light', 'dark', 'high-contrast'];

// One distinguishing token set per appearance and color: Badge's palette, with the outline text
// in the brand color for `brand` (the look CounterBadge had before it took a color).
const COLOR_CLASSES: Array<[CounterBadgeAppearance, BadgeColor, string[]]> = [
  ['filled', 'brand', ['bg-primary', 'text-primary-foreground']],
  ['filled', 'success', ['bg-success', 'text-success-foreground']],
  ['filled', 'warning', ['bg-warning', 'text-warning-foreground']],
  ['filled', 'danger', ['bg-destructive', 'text-destructive-foreground']],
  ['filled', 'important', ['bg-severe', 'text-severe-foreground']],
  ['filled', 'informative', ['bg-muted', 'text-foreground']],
  ['filled', 'severe', ['bg-severe', 'text-severe-foreground']],
  ['filled', 'subtle', ['bg-background', 'text-foreground']],
  ['outline', 'brand', ['bg-transparent', 'border', 'border-primary', 'text-primary']],
  ['outline', 'success', ['bg-transparent', 'border', 'border-success', 'text-foreground']],
  ['outline', 'warning', ['bg-transparent', 'border', 'border-warning', 'text-foreground']],
  ['outline', 'danger', ['bg-transparent', 'border', 'border-destructive', 'text-foreground']],
  ['outline', 'important', ['bg-transparent', 'border', 'border-severe', 'text-foreground']],
  ['outline', 'informative', ['bg-transparent', 'border', 'border-border', 'text-foreground']],
  ['outline', 'severe', ['bg-transparent', 'border', 'border-severe', 'text-foreground']],
  ['outline', 'subtle', ['bg-transparent', 'border', 'border-border', 'text-foreground']],
];

/**
 * A dot has no text, so its own color must stand out from the page (3:1, WCAG 1.4.11; each token
 * is asserted against `background` in tokens.test.ts): informative and warning take darker tokens
 * than their count badges. `subtle` keeps the page color, for dots on colored surfaces.
 */
const DOT_COLOR_CLASSES: Array<[BadgeColor, fill: string, ring: string]> = [
  ['brand', 'bg-primary', 'border-primary'],
  ['success', 'bg-success', 'border-success'],
  ['warning', 'bg-warning-tint-foreground', 'border-warning-tint-foreground'],
  ['danger', 'bg-destructive', 'border-destructive'],
  ['important', 'bg-severe', 'border-severe'],
  ['informative', 'bg-muted-foreground', 'border-muted-foreground'],
  ['severe', 'bg-severe', 'border-severe'],
  ['subtle', 'bg-background', 'border-border'],
];

const DOT_CLASSES = ['h-1.5', 'w-1.5', 'min-w-0', 'p-0'];
const DOT_FORCED_COLORS = [
  'forced-colors:forced-color-adjust-none',
  'forced-colors:bg-[CanvasText]',
];

describe('CounterBadge', () => {
  testSystemProps(CounterBadge, {
    expectedTag: 'span',
    displayName: 'CounterBadge',
    defaultProps: { count: 5 },
    a11yVariants: [
      { name: 'outline', props: { appearance: 'outline' } },
      { name: 'named dot', props: { dot: true, 'aria-label': 'Unread messages' } },
      { name: 'zero with showZero', props: { count: 0, showZero: true } },
    ],
  });

  it('renders the count', () => {
    render(<CounterBadge count={7} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('returns null when count is 0', () => {
    const { container } = render(<CounterBadge count={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when count is negative', () => {
    const { container } = render(<CounterBadge count={-3} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows overflow count with default overflowCount of 99', () => {
    render(<CounterBadge count={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('respects custom overflowCount', () => {
    render(<CounterBadge count={15} overflowCount={10} />);
    expect(screen.getByText('10+')).toBeInTheDocument();
  });

  it('shows exact count when equal to overflowCount', () => {
    render(<CounterBadge count={99} />);
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  // The default (brand) color keeps its 0.5 look, in theme tokens only.
  it.each([
    ['filled', ['bg-primary', 'text-primary-foreground']],
    ['outline', ['bg-transparent', 'border', 'border-primary', 'text-primary']],
  ] as const)('%s appearance uses %j', (appearance, classes) => {
    render(<CounterBadge count={5} appearance={appearance} data-testid="cb" />);
    const badge = screen.getByTestId('cb');
    expect(badge).toHaveClass(...classes);
    expect(badge.className).not.toMatch(/#|\bwhite\b/);
  });

  describe('count', () => {
    it('is optional and defaults to 0, which renders nothing', () => {
      const { container } = render(<CounterBadge />);
      expect(container).toBeEmptyDOMElement();
    });

    it('shows "0" for a count of 0 with showZero', () => {
      render(<CounterBadge count={0} showZero data-testid="cb" />);
      expect(screen.getByTestId('cb')).toHaveTextContent(/^0$/);
    });

    it('shows "0" with showZero when count is left out', () => {
      render(<CounterBadge showZero data-testid="cb" />);
      expect(screen.getByTestId('cb')).toHaveTextContent(/^0$/);
    });

    it('renders nothing for a negative count, even with showZero', () => {
      const { container } = render(<CounterBadge count={-1} showZero />);
      expect(container).toBeEmptyDOMElement();
    });

    it('showZero does not change a positive count or the overflow', () => {
      render(
        <>
          <CounterBadge count={3} showZero data-testid="three" />
          <CounterBadge count={150} showZero data-testid="overflow" />
        </>,
      );
      expect(screen.getByTestId('three')).toHaveTextContent(/^3$/);
      expect(screen.getByTestId('overflow')).toHaveTextContent(/^99\+$/);
    });
  });

  describe('dot', () => {
    it('renders a small dot without text, ignoring count', () => {
      render(<CounterBadge dot count={5} data-testid="cb" />);
      const dot = screen.getByTestId('cb');
      expect(dot).toBeEmptyDOMElement();
      expect(dot).toHaveClass(...DOT_CLASSES);
      expect(dot).not.toHaveClass('h-5', 'min-w-5', 'px-1.5');
    });

    it('renders for a count of 0, a negative count and without a count', () => {
      render(
        <>
          <CounterBadge dot data-testid="no-count" />
          <CounterBadge dot count={0} data-testid="zero" />
          <CounterBadge dot count={-2} data-testid="negative" />
        </>,
      );
      for (const id of ['no-count', 'zero', 'negative']) {
        expect(screen.getByTestId(id)).toBeEmptyDOMElement();
        expect(screen.getByTestId(id)).toHaveAttribute('data-dot', '');
      }
    });

    it('ignores overflowCount and showZero', () => {
      render(<CounterBadge dot count={150} overflowCount={10} showZero data-testid="cb" />);
      expect(screen.getByTestId('cb')).toBeEmptyDOMElement();
    });

    it('marks the dot with a boolean data-dot, absent on a count', () => {
      render(
        <>
          <CounterBadge dot data-testid="dot" />
          <CounterBadge count={5} data-testid="count" />
        </>,
      );
      expect(screen.getByTestId('dot')).toHaveAttribute('data-dot', '');
      expect(screen.getByTestId('count')).not.toHaveAttribute('data-dot');
    });

    it('lists a dot fill and ring for every color', () => {
      expect(DOT_COLOR_CLASSES.map(([color]) => color)).toEqual(COLORS);
    });

    it.each(DOT_COLOR_CLASSES)(
      'takes the dot color of %s: filled %s, outline ring %s',
      (color, fill, ring) => {
        render(
          <>
            <CounterBadge dot color={color} data-testid="filled" />
            <CounterBadge dot appearance="outline" color={color} data-testid="outline" />
          </>,
        );
        expect(screen.getByTestId('filled')).toHaveClass(fill);
        expect(screen.getByTestId('outline')).toHaveClass('bg-transparent', 'border', ring);
      },
    );

    it.each([
      ['informative', 'bg-muted', 'border-border'],
      ['warning', 'bg-warning', 'border-warning'],
    ] as const)(
      'the %s dot does not use %s or %s, which are faint on the page background',
      (color, countFill, countRing) => {
        render(
          <>
            <CounterBadge dot color={color} data-testid="filled" />
            <CounterBadge dot appearance="outline" color={color} data-testid="outline" />
            <CounterBadge count={3} color={color} data-testid="count" />
          </>,
        );
        expect(screen.getByTestId('filled')).not.toHaveClass(countFill);
        expect(screen.getByTestId('outline')).not.toHaveClass(countRing);
        // The count keeps Badge's colors: its text carries the contrast.
        expect(screen.getByTestId('count')).toHaveClass(countFill);
      },
    );

    it('opts out of forced colors and fills with CanvasText, so it stays visible', () => {
      render(
        <>
          <CounterBadge dot data-testid="filled" />
          <CounterBadge dot appearance="outline" data-testid="outline" />
        </>,
      );
      expect(screen.getByTestId('filled')).toHaveClass(...DOT_FORCED_COLORS);
      expect(screen.getByTestId('outline')).toHaveClass(...DOT_FORCED_COLORS);
    });

    it('a count keeps forced colors, so its number is drawn in system colors', () => {
      render(<CounterBadge count={5} data-testid="cb" />);
      const badge = screen.getByTestId('cb');
      for (const cls of DOT_FORCED_COLORS) expect(badge).not.toHaveClass(cls);
    });
  });

  describe('colors', () => {
    it('lists token classes for every color and appearance', () => {
      const listed = new Set(COLOR_CLASSES.map(([appearance, color]) => `${appearance} ${color}`));
      const expected = APPEARANCES.flatMap((appearance) =>
        COLORS.map((color) => `${appearance} ${color}`),
      );
      expect(expected.filter((key) => !listed.has(key))).toEqual([]);
    });

    it.each(COLOR_CLASSES)('%s %s uses %j', (appearance, color, classes) => {
      render(<CounterBadge count={5} appearance={appearance} color={color} data-testid="cb" />);
      expect(screen.getByTestId('cb')).toHaveClass(...classes);
    });

    it.each(COLORS)('filled %s uses the same classes as a Badge of that color', (color) => {
      render(<CounterBadge count={5} color={color} data-testid="cb" />);
      expect(screen.getByTestId('cb')).toHaveClass(...badgeColorClasses[color].filled.split(' '));
    });

    // Before 0.6 CounterBadge had no `color` prop: the span's HTML `color?: string` attribute applied.
    it.each([
      ['an unknown string', 'red'],
      ['null', null],
    ])('falls back to brand for %s from untyped code instead of failing to render', (_, color) => {
      render(
        <>
          <CounterBadge count={3} {...({ color } as object)} data-testid="count" />
          <CounterBadge dot {...({ color } as object)} data-testid="dot" />
        </>,
      );
      const count = screen.getByTestId('count');
      expect(count).toHaveTextContent(/^3$/);
      expect(count).toHaveAttribute('data-color', 'brand');
      expect(count).toHaveClass('bg-primary', 'text-primary-foreground');
      expect(count).not.toHaveAttribute('color');
      expect(screen.getByTestId('dot')).toHaveAttribute('data-color', 'brand');
      expect(screen.getByTestId('dot')).toHaveClass('bg-primary');
    });

    it.each(COLORS.filter((color) => color !== 'brand'))(
      'outline %s draws its text in the foreground color, not the brand color',
      (color) => {
        render(<CounterBadge count={5} appearance="outline" color={color} data-testid="cb" />);
        expect(screen.getByTestId('cb')).not.toHaveClass('text-primary');
      },
    );

    it.each(APPEARANCES.flatMap((appearance) => COLORS.map((color) => [appearance, color])))(
      '%s %s uses no raw colors',
      (appearance, color) => {
        render(
          <CounterBadge
            count={5}
            appearance={appearance as CounterBadgeAppearance}
            color={color as BadgeColor}
            data-testid="cb"
          />,
        );
        expect(screen.getByTestId('cb').className).not.toMatch(/#|\bwhite\b|\bblack\b/);
      },
    );

    it.each(THEMES)(
      'every color and appearance has no axe violations in the %s theme',
      async (theme) => {
        renderWithProviders(
          <div>
            {APPEARANCES.flatMap((appearance) =>
              COLORS.map((color) => (
                <CounterBadge
                  key={`${appearance}-${color}`}
                  count={COLORS.indexOf(color) + 1}
                  appearance={appearance}
                  color={color}
                />
              )),
            )}
          </div>,
          { theme },
        );
        await expectNoA11yViolations();
      },
    );
  });

  describe('state attributes', () => {
    it('always renders data-color and data-appearance, with the defaults brand and filled', () => {
      render(<CounterBadge count={5} data-testid="cb" />);
      const badge = screen.getByTestId('cb');
      expect(badge).toHaveAttribute('data-color', 'brand');
      expect(badge).toHaveAttribute('data-appearance', 'filled');
    });

    it('renders the resolved color and appearance, also on a dot', () => {
      render(
        <>
          <CounterBadge count={5} appearance="outline" color="severe" data-testid="count" />
          <CounterBadge dot color="danger" data-testid="dot" />
        </>,
      );
      expect(screen.getByTestId('count')).toHaveAttribute('data-color', 'severe');
      expect(screen.getByTestId('count')).toHaveAttribute('data-appearance', 'outline');
      expect(screen.getByTestId('dot')).toHaveAttribute('data-color', 'danger');
      expect(screen.getByTestId('dot')).toHaveAttribute('data-appearance', 'filled');
    });
  });

  describe('naming', () => {
    it('gets role="img" with an aria-label, so the name is announced', () => {
      render(<CounterBadge count={3} aria-label="3 unread messages" />);
      expect(screen.getByRole('img', { name: '3 unread messages' })).toHaveTextContent('3');
    });

    it('gets role="img" with aria-labelledby', () => {
      render(
        <>
          <span id="counter-name">Unread messages</span>
          <CounterBadge count={3} aria-labelledby="counter-name" />
        </>,
      );
      expect(screen.getByRole('img', { name: 'Unread messages' })).toHaveTextContent('3');
    });

    it('names a dot', () => {
      render(<CounterBadge dot aria-label="New activity" />);
      expect(screen.getByRole('img', { name: 'New activity' })).toBeEmptyDOMElement();
    });

    it('has no role without a naming attribute', () => {
      render(
        <>
          <CounterBadge count={3} data-testid="count" />
          <CounterBadge dot data-testid="dot" />
        </>,
      );
      expect(screen.getByTestId('count')).not.toHaveAttribute('role');
      expect(screen.getByTestId('dot')).not.toHaveAttribute('role');
      expect(screen.queryByRole('img')).toBeNull();
    });

    it.each([
      ['an empty aria-label', { 'aria-label': '' }],
      ['a whitespace-only aria-label', { 'aria-label': ' ' }],
      ['a whitespace-only aria-labelledby', { 'aria-labelledby': ' \t' }],
    ])('%s names nothing, so no role is added', (_label, name) => {
      render(<CounterBadge count={3} {...name} data-testid="cb" />);
      expect(screen.getByTestId('cb')).not.toHaveAttribute('role');
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('a whitespace-only aria-label (a missing translation) has no axe violations', async () => {
      render(
        <p>
          Inbox <CounterBadge count={2} aria-label=" " /> <CounterBadge dot aria-label=" " />
        </p>,
      );
      await expectNoA11yViolations();
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('a consumer role wins', () => {
      render(<CounterBadge count={3} role="status" aria-label="3 unread messages" />);
      expect(screen.getByRole('status', { name: '3 unread messages' })).toHaveTextContent('3');
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('a named dot has no axe violations', async () => {
      render(
        <p>
          Inbox <CounterBadge dot aria-label="Unread messages" />
        </p>,
      );
      await expectNoA11yViolations();
    });

    it('a plain count has no axe violations', async () => {
      render(
        <p>
          Inbox <CounterBadge count={12} />
        </p>,
      );
      await expectNoA11yViolations();
    });
  });

  describe('types', () => {
    it('count is optional', () => {
      expectTypeOf<CounterBadgeProps['count']>().toEqualTypeOf<number | undefined>();
    });

    it('color takes the Badge palette; dot and showZero are booleans', () => {
      expectTypeOf<CounterBadgeProps['color']>().toEqualTypeOf<BadgeColor | undefined>();
      expectTypeOf<CounterBadgeProps['dot']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<CounterBadgeProps['showZero']>().toEqualTypeOf<boolean | undefined>();
    });

    it('rejects a color outside the palette', () => {
      // @ts-expect-error `pink` is not a BadgeColor
      const element = <CounterBadge count={1} color="pink" />;
      expect(element).toBeTruthy();
    });
  });

  // C-REF: ref is declared in the props interface.
  it('declares ref in CounterBadgeProps (C-REF)', () => {
    expectTypeOf<CounterBadgeProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
  });
});
