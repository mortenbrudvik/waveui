import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Badge } from '../Badge';
import { CounterBadge } from '../CounterBadge';
import { badgeColorClasses } from '../Badge.colors';
import { hasWarned } from '../../../lib/dev';
import type { BadgeAppearance, BadgeColor } from '../../../lib/types';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';
import {
  THEMES,
  contrastRatio,
  resolved,
  type ThemeName,
} from '../../../styles/__tests__/tokensHarness';

/*
 * 1.0 (P14-05, spec R3): `color="important"` is Fluent's neutral high-emphasis badge (filled: the
 * page's text color as the fill and the page color as the text; tint: the secondary text color as
 * the fill), no longer the orange it drew through 0.x, and the 0.18 development notice of the
 * change is gone. `severe` keeps the orange look of 0.6.
 */

const BADGE_APPEARANCES: BadgeAppearance[] = ['filled', 'tint', 'outline'];

/** Every class of the `important` look per appearance, with the tokens of the fill and text. */
const IMPORTANT_LOOK: Array<
  [BadgeAppearance, classes: string[], fill: string | null, text: string | null]
> = [
  ['filled', ['bg-foreground', 'text-background'], 'foreground', 'background'],
  ['tint', ['bg-muted-foreground', 'text-background'], 'muted-foreground', 'background'],
  // The outline is Badge's transparent box with the page's text color, in the accessible stroke.
  [
    'outline',
    ['bg-transparent', 'border', 'text-foreground', 'border-stroke-accessible'],
    null,
    null,
  ],
];

/** The orange look `severe` keeps (and `important` drew through 0.x), pinned. */
const SEVERE_CLASSES = {
  filled: 'bg-severe text-severe-foreground',
  tint: 'bg-severe-tint text-severe-tint-foreground',
  border: 'border-severe',
  dot: 'bg-severe',
  dotBorder: 'border-severe',
};

/** The words of the orange look, none of which an `important` badge carries any more. */
const SEVERE_WORDS = [
  'bg-severe',
  'text-severe-foreground',
  'bg-severe-tint',
  'text-severe-tint-foreground',
  'border-severe',
];

/** The neutral fill and text of the light, dark and high-contrast themes (`tokens.css`). */
const NEUTRAL_COLORS: Record<ThemeName, { fill: string; text: string; tint: string }> = {
  // Near black with white text (Fluent's colorNeutralForeground1 and colorNeutralBackground1).
  light: { fill: '#242424', text: '#ffffff', tint: '#616161' },
  // Inverted: white with the dark page color as the text.
  dark: { fill: '#ffffff', text: '#292929', tint: '#adadad' },
  // White on the black page, with black text.
  'high-contrast': { fill: '#ffffff', text: '#000000', tint: '#ffffff' },
};

describe('Badge and CounterBadge color="important" (1.0)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps important to the neutral tokens and severe to the unchanged orange ones', () => {
    expect(badgeColorClasses.important).toEqual({
      filled: 'bg-foreground text-background',
      tint: 'bg-muted-foreground text-background',
      border: 'border-stroke-accessible',
      dot: 'bg-foreground',
      dotBorder: 'border-foreground',
    });
    expect(badgeColorClasses.severe).toEqual(SEVERE_CLASSES);
  });

  describe.each(THEMES)('in the %s theme', (theme) => {
    it.each(IMPORTANT_LOOK)('a Badge %s draws the neutral look', (appearance, classes) => {
      renderWithProviders(
        <Badge appearance={appearance} color="important" data-testid="badge">
          Important
        </Badge>,
        { theme },
      );
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass(...classes);
      expect(badge).toHaveAttribute('data-color', 'important');
      for (const word of SEVERE_WORDS) expect(badge).not.toHaveClass(word);
    });

    it('resolves the fill and text tokens to the neutral colors, with text contrast', () => {
      const colors = NEUTRAL_COLORS[theme];
      for (const [, , fill, text] of IMPORTANT_LOOK) {
        if (fill === null || text === null) continue;
        expect(contrastRatio(resolved(theme, fill), resolved(theme, text))).toBeGreaterThanOrEqual(
          4.5,
        );
      }
      expect(resolved(theme, 'foreground')).toBe(colors.fill);
      expect(resolved(theme, 'background')).toBe(colors.text);
      expect(resolved(theme, 'muted-foreground')).toBe(colors.tint);
      // The dot and its ring stand out from the page; the outline's stroke too (3:1).
      expect(
        contrastRatio(resolved(theme, 'foreground'), resolved(theme, 'background')),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(resolved(theme, 'stroke-accessible'), resolved(theme, 'background')),
      ).toBeGreaterThanOrEqual(3);
    });

    it('a CounterBadge count and dot draw the same neutral look', () => {
      renderWithProviders(
        <>
          <CounterBadge count={3} color="important" data-testid="filled" />
          <CounterBadge count={3} appearance="outline" color="important" data-testid="outline" />
          <CounterBadge dot color="important" data-testid="dot" />
          <CounterBadge dot appearance="outline" color="important" data-testid="dot-outline" />
        </>,
        { theme },
      );
      expect(screen.getByTestId('filled')).toHaveClass('bg-foreground', 'text-background');
      expect(screen.getByTestId('outline')).toHaveClass(
        'bg-transparent',
        'border',
        'border-stroke-accessible',
        'text-foreground',
      );
      expect(screen.getByTestId('dot')).toHaveClass('bg-foreground');
      expect(screen.getByTestId('dot-outline')).toHaveClass('bg-transparent', 'border-foreground');
      for (const id of ['filled', 'outline', 'dot', 'dot-outline']) {
        expect(screen.getByTestId(id)).toHaveAttribute('data-color', 'important');
        for (const word of SEVERE_WORDS) expect(screen.getByTestId(id)).not.toHaveClass(word);
      }
    });

    it('important and severe badges have no axe violations', async () => {
      renderWithProviders(
        <div>
          {BADGE_APPEARANCES.flatMap((appearance) =>
            (['important', 'severe'] as const).map((color) => (
              <Badge key={`${appearance}-${color}`} appearance={appearance} color={color}>
                {`${appearance} ${color}`}
              </Badge>
            )),
          )}
          <CounterBadge count={2} color="important" />
          <CounterBadge dot color="important" aria-label="Important activity" />
        </div>,
        { theme },
      );
      await expectNoA11yViolations();
    });
  });

  it.each(BADGE_APPEARANCES)('severe keeps the orange look of 0.6 (%s)', (appearance) => {
    render(
      <>
        <Badge appearance={appearance} color="severe" data-testid="severe">
          Severe
        </Badge>
        <Badge appearance={appearance} color="important" data-testid="important">
          Important
        </Badge>
      </>,
    );
    const expected = appearance === 'outline' ? SEVERE_CLASSES.border : SEVERE_CLASSES[appearance];
    expect(screen.getByTestId('severe')).toHaveClass(...expected.split(' '));
    // The two colors no longer share a look.
    expect(screen.getByTestId('important').className).not.toBe(
      screen.getByTestId('severe').className,
    );
  });

  const elements: Array<[string, () => React.ReactElement]> = [
    ['Badge', () => <Badge color="important">Text</Badge>],
    ['CounterBadge', () => <CounterBadge count={3} color="important" />],
    ['a CounterBadge dot', () => <CounterBadge dot color="important" />],
  ];

  it.each(elements)(
    '%s logs nothing: the 0.18 notice that the meaning changes is gone',
    (_name, element) => {
      const ui = <React.StrictMode>{element()}</React.StrictMode>;
      const { rerender } = render(ui);
      rerender(ui);
      expect(warn).not.toHaveBeenCalled();
      expect(hasWarned('Badge:color:important')).toBe(false);
      expect(hasWarned('CounterBadge:color:important')).toBe(false);
    },
  );

  it.each(elements)('%s renders the same look on the server', (_name, element) => {
    const parsed = document.createElement('div'); // detached: nothing reaches document.body
    parsed.innerHTML = renderToString(element());
    const badge = parsed.firstElementChild;
    expect(badge).toHaveAttribute('data-color', 'important');
    expect(badge).toHaveClass('bg-foreground');
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps important in the palette type', () => {
    const color: BadgeColor = 'important';
    expect(Object.keys(badgeColorClasses)).toContain(color);
  });
});
