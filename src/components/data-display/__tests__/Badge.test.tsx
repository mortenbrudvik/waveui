import type * as React from 'react';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';
import type { BadgeProps } from '../Badge';
import { expectNoA11yViolations, renderWithProviders, testSystemProps } from '../../../test-utils';
import type { BadgeAppearance, BadgeColor, Size } from '../../../lib/types';
import type { WaveTheme } from '../../../lib/theme';

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
const APPEARANCES: BadgeAppearance[] = ['filled', 'tint', 'outline'];
const THEMES: WaveTheme[] = ['light', 'dark', 'high-contrast'];

// One distinguishing token set per appearance and color.
const COLOR_CLASSES: Array<[BadgeAppearance, BadgeColor, string[]]> = [
  ['filled', 'brand', ['bg-primary', 'text-primary-foreground']],
  ['filled', 'success', ['bg-success', 'text-success-foreground']],
  ['filled', 'warning', ['bg-warning', 'text-warning-foreground']],
  ['filled', 'danger', ['bg-destructive', 'text-destructive-foreground']],
  ['filled', 'important', ['bg-severe', 'text-severe-foreground']],
  ['filled', 'informative', ['bg-muted', 'text-foreground']],
  ['filled', 'severe', ['bg-severe', 'text-severe-foreground']],
  ['filled', 'subtle', ['bg-background', 'text-foreground']],
  ['tint', 'brand', ['bg-info-tint', 'text-info-tint-foreground']],
  ['tint', 'success', ['bg-success-tint', 'text-success-tint-foreground']],
  ['tint', 'warning', ['bg-warning-tint', 'text-warning-tint-foreground']],
  ['tint', 'danger', ['bg-error-tint', 'text-error-tint-foreground']],
  ['tint', 'important', ['bg-severe-tint', 'text-severe-tint-foreground']],
  ['tint', 'informative', ['bg-muted', 'text-foreground']],
  ['tint', 'severe', ['bg-severe-tint', 'text-severe-tint-foreground']],
  ['tint', 'subtle', ['bg-background', 'text-muted-foreground', 'border', 'border-border']],
  ['outline', 'brand', ['bg-transparent', 'border', 'border-primary', 'text-foreground']],
  ['outline', 'success', ['border-success']],
  ['outline', 'warning', ['border-warning']],
  ['outline', 'danger', ['border-destructive']],
  ['outline', 'important', ['border-severe']],
  ['outline', 'informative', ['border-border']],
  ['outline', 'severe', ['bg-transparent', 'border', 'border-severe', 'text-foreground']],
  ['outline', 'subtle', ['bg-transparent', 'border', 'border-border', 'text-foreground']],
];

describe('Badge', () => {
  testSystemProps(Badge, {
    expectedTag: 'span',
    displayName: 'Badge',
    defaultProps: { children: 'Label' },
    conflictingClass: { className: 'px-4', overrides: 'px-2' },
    a11yVariants: APPEARANCES.map((appearance) => ({ name: appearance, props: { appearance } })),
  });

  it('renders children text', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('lists token classes for every color and appearance', () => {
    const listed = new Set(COLOR_CLASSES.map(([appearance, color]) => `${appearance} ${color}`));
    const expected = APPEARANCES.flatMap((appearance) =>
      COLORS.map((color) => `${appearance} ${color}`),
    );
    expect(expected.filter((key) => !listed.has(key))).toEqual([]);
  });

  it.each(COLOR_CLASSES)('%s %s uses %j', (appearance, color, classes) => {
    render(
      <Badge appearance={appearance} color={color} data-testid="badge">
        Label
      </Badge>,
    );
    expect(screen.getByTestId('badge')).toHaveClass(...classes);
  });

  it('severe renders the orange colors important has in 0.x', () => {
    for (const appearance of APPEARANCES) {
      const { unmount } = render(
        <>
          <Badge appearance={appearance} color="important" data-testid="important">
            Important
          </Badge>
          <Badge appearance={appearance} color="severe" data-testid="severe">
            Severe
          </Badge>
        </>,
      );
      expect(screen.getByTestId('severe').className).toBe(
        screen.getByTestId('important').className,
      );
      unmount();
    }
  });

  it.each(APPEARANCES.flatMap((appearance) => COLORS.map((color) => [appearance, color])))(
    '%s %s uses no raw colors',
    (appearance, color) => {
      render(
        <Badge
          appearance={appearance as BadgeAppearance}
          color={color as BadgeColor}
          data-testid="badge"
        >
          Label
        </Badge>,
      );
      expect(screen.getByTestId('badge').className).not.toMatch(/#|\bwhite\b|\bblack\b/);
    },
  );

  it.each([
    ['extra-small', ['text-[10px]', 'px-1']],
    ['small', ['text-[10px]', 'px-1']],
    ['medium', ['text-caption-1', 'px-2']],
    ['large', ['text-body-2', 'px-2.5']],
    ['extra-large', ['text-body-2', 'px-2.5']],
  ] as Array<[Size, string[]]>)('size %s applies %j', (size, classes) => {
    render(
      <Badge size={size} data-testid="badge">
        Label
      </Badge>,
    );
    expect(screen.getByTestId('badge')).toHaveClass(...classes);
  });

  describe('state attributes', () => {
    it('always renders data-color and data-appearance, with the defaults brand and filled', () => {
      render(<Badge data-testid="badge">Label</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-color', 'brand');
      expect(badge).toHaveAttribute('data-appearance', 'filled');
    });

    it('renders the resolved color and appearance', () => {
      render(
        <Badge appearance="tint" color="severe" data-testid="badge">
          Label
        </Badge>,
      );
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-color', 'severe');
      expect(badge).toHaveAttribute('data-appearance', 'tint');
    });
  });

  describe('naming', () => {
    it('gets role="img" with an aria-label, so the name is announced', () => {
      render(<Badge aria-label="3 new messages">3</Badge>);
      expect(screen.getByRole('img', { name: '3 new messages' })).toHaveTextContent('3');
    });

    it('gets role="img" with aria-labelledby', () => {
      render(
        <>
          <span id="badge-name">Beta feature</span>
          <Badge aria-labelledby="badge-name">Beta</Badge>
        </>,
      );
      expect(screen.getByRole('img', { name: 'Beta feature' })).toHaveTextContent('Beta');
    });

    it('has no role without a naming attribute', () => {
      render(<Badge data-testid="badge">New</Badge>);
      expect(screen.getByTestId('badge')).not.toHaveAttribute('role');
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('a consumer role wins', () => {
      render(
        <Badge role="status" aria-label="Build passed">
          Passed
        </Badge>,
      );
      expect(screen.getByRole('status', { name: 'Build passed' })).toHaveTextContent('Passed');
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('a named badge has no axe violations', async () => {
      render(
        <p>
          Inbox <Badge aria-label="3 unread messages">3</Badge>
        </p>,
      );
      expect(screen.getByRole('img', { name: '3 unread messages' })).toHaveTextContent('3');
      await expectNoA11yViolations();
    });
  });

  it.each(THEMES)(
    'severe and subtle badges have no axe violations in the %s theme',
    async (theme) => {
      renderWithProviders(
        <div>
          {APPEARANCES.flatMap((appearance) =>
            (['severe', 'subtle'] as const).map((color) => (
              <Badge key={`${appearance}-${color}`} appearance={appearance} color={color}>
                {`${appearance} ${color}`}
              </Badge>
            )),
          )}
        </div>,
        { theme },
      );
      await expectNoA11yViolations();
    },
  );

  it('BadgeColor includes severe and subtle', () => {
    expectTypeOf<BadgeColor>().toEqualTypeOf<
      'brand' | 'success' | 'warning' | 'danger' | 'important' | 'informative' | 'severe' | 'subtle'
    >();
    expectTypeOf<BadgeProps['color']>().toEqualTypeOf<BadgeColor | undefined>();
  });

  // C-REF: ref is declared in the props interface.
  it('declares ref in BadgeProps (C-REF)', () => {
    expectTypeOf<BadgeProps['ref']>().toEqualTypeOf<React.Ref<HTMLSpanElement> | undefined>();
  });
});
