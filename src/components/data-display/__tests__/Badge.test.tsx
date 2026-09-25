import type * as React from 'react';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';
import type { BadgeProps } from '../Badge';
import { testSystemProps } from '../../../test-utils';
import type { BadgeAppearance, BadgeColor, Size } from '../../../lib/types';

const COLORS: BadgeColor[] = ['brand', 'success', 'warning', 'danger', 'important', 'informative'];
const APPEARANCES: BadgeAppearance[] = ['filled', 'tint', 'outline'];

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

  // data-display#16 + input-basic#8: one distinguishing token pair per appearance and color.
  it.each([
    ['filled', 'brand', ['bg-primary', 'text-primary-foreground']],
    ['filled', 'success', ['bg-success', 'text-success-foreground']],
    ['filled', 'warning', ['bg-warning', 'text-warning-foreground']],
    ['filled', 'danger', ['bg-destructive', 'text-destructive-foreground']],
    ['filled', 'important', ['bg-severe', 'text-severe-foreground']],
    ['filled', 'informative', ['bg-muted', 'text-foreground']],
    ['tint', 'brand', ['bg-info-tint', 'text-info-tint-foreground']],
    ['tint', 'success', ['bg-success-tint', 'text-success-tint-foreground']],
    ['tint', 'warning', ['bg-warning-tint', 'text-warning-tint-foreground']],
    ['tint', 'danger', ['bg-error-tint', 'text-error-tint-foreground']],
    ['tint', 'important', ['bg-severe-tint', 'text-severe-tint-foreground']],
    ['tint', 'informative', ['bg-muted', 'text-foreground']],
    ['outline', 'brand', ['bg-transparent', 'border', 'border-primary', 'text-foreground']],
    ['outline', 'success', ['border-success']],
    ['outline', 'warning', ['border-warning']],
    ['outline', 'danger', ['border-destructive']],
    ['outline', 'important', ['border-severe']],
    ['outline', 'informative', ['border-border']],
  ] as Array<[BadgeAppearance, BadgeColor, string[]]>)(
    '%s %s uses %j',
    (appearance, color, classes) => {
      render(
        <Badge appearance={appearance} color={color} data-testid="badge">
          Label
        </Badge>,
      );
      expect(screen.getByTestId('badge')).toHaveClass(...classes);
    },
  );

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

  // button-provider#27 (C-REF): ref is declared in the props interface.
  it('declares ref in BadgeProps (C-REF)', () => {
    expectTypeOf<BadgeProps['ref']>().toEqualTypeOf<React.Ref<HTMLSpanElement> | undefined>();
  });
});
