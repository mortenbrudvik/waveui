import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  buttonBaseClasses,
  buttonSizeClasses,
  buttonIconOnlySizeClasses,
  buttonAppearanceClasses,
  buttonPressedClasses,
  buttonPressedAccessibleClasses,
  buttonDisabledClasses,
  buttonClassName,
} from '../buttonStyles';
import { wcn } from '../../../lib/cn';
import type { Appearance, Size } from '../../../lib/types';

const appearances: Appearance[] = ['primary', 'outline', 'subtle', 'transparent'];
const sizes: Size[] = ['extra-small', 'small', 'medium', 'large', 'extra-large'];

const HOVER_GATE = 'not-disabled:not-aria-disabled:hover:';
const ACTIVE_GATE = 'not-disabled:not-aria-disabled:active:';

/** Every class string the module exports, labelled for failure messages. */
const allClassStrings: Array<[string, string]> = [
  ['buttonBaseClasses', buttonBaseClasses],
  ['buttonDisabledClasses', buttonDisabledClasses],
  ...sizes.map((s): [string, string] => [`buttonSizeClasses.${s}`, buttonSizeClasses[s]]),
  ...sizes.map((s): [string, string] => [
    `buttonIconOnlySizeClasses.${s}`,
    buttonIconOnlySizeClasses[s],
  ]),
  ...appearances.map((a): [string, string] => [
    `buttonAppearanceClasses.${a}`,
    buttonAppearanceClasses[a],
  ]),
  ...appearances.map((a): [string, string] => [
    `buttonPressedClasses.${a}`,
    buttonPressedClasses[a],
  ]),
  ...appearances.map((a): [string, string] => [
    `buttonPressedAccessibleClasses.${a}`,
    buttonPressedAccessibleClasses[a],
  ]),
];

const classesOf = (value: string) => value.split(/\s+/).filter(Boolean);

// Vitest empties `*.css?raw` imports (CSS processing is off), so the ramp is read from disk: from
// theme.css, the internal theme the components' classes compile against (tokens.css holds only
// the namespaced keys apps use, `--text-wave-*`).
const THEME_CSS = readFileSync(
  join(import.meta.dirname, '..', '..', '..', 'styles', 'theme.css'),
  'utf8',
);

/** Tailwind's default font sizes, in rem (px at the default 16px root). */
const TAILWIND_REM_FONT_SIZES: Record<string, number> = {
  'text-xs': 0.75,
  'text-sm': 0.875,
  'text-base': 1,
  'text-lg': 1.125,
  'text-xl': 1.25,
};

interface FontSize {
  /** The size in px (at the default 16px root for a rem size). */
  px: number;
  /** The unit the size is declared in; only `px` keeps its place in a px ramp at any root size. */
  unit: 'px' | 'rem';
}

/**
 * The font size a single class of Wave's sets, or `undefined` when it sets none: a type-ramp
 * token (`text-body-2`, resolved from its `--text-*` declaration in theme.css), an arbitrary px
 * size (`text-[18px]`, optionally with a px line height `/[24px]`) or a Tailwind default rem
 * size, each written with the utility prefix (`wave:text-body-2`); a class without it sets none.
 */
function fontSizeOfClass(prefixed: string): FontSize | undefined {
  if (!prefixed.startsWith('wave:')) return undefined;
  const cls = prefixed.slice('wave:'.length);
  const arbitraryPx = /^text-\[(\d+(?:\.\d+)?)px\](?:\/\[\d+(?:\.\d+)?px\])?$/.exec(cls);
  if (arbitraryPx) return { px: Number(arbitraryPx[1]), unit: 'px' };
  const rem = TAILWIND_REM_FONT_SIZES[cls];
  if (rem !== undefined) return { px: rem * 16, unit: 'rem' };
  const token = /^text-([a-z0-9-]+)$/.exec(cls);
  if (!token) return undefined;
  const declaration = new RegExp(
    `(?:^|[\\s;{])--text-${token[1]}:\\s*(\\d+(?:\\.\\d+)?)(px|rem);`,
  ).exec(THEME_CSS);
  if (!declaration) return undefined;
  const value = Number(declaration[1]);
  return declaration[2] === 'px' ? { px: value, unit: 'px' } : { px: value * 16, unit: 'rem' };
}

const fontSizeDetailsOf = (value: string): FontSize => {
  const sizesFound = classesOf(value)
    .map(fontSizeOfClass)
    .filter((size): size is FontSize => size !== undefined);
  expect(sizesFound, `exactly one known font-size class in "${value}"`).toHaveLength(1);
  return sizesFound[0];
};

/** Font size in px of the one font-size class in a class string. */
const fontSizeOf = (value: string): number => fontSizeDetailsOf(value).px;

describe('buttonStyles', () => {
  describe('maps', () => {
    it('defines every appearance and size', () => {
      expect(Object.keys(buttonAppearanceClasses).sort()).toEqual([...appearances].sort());
      expect(Object.keys(buttonPressedClasses).sort()).toEqual([...appearances].sort());
      expect(Object.keys(buttonPressedAccessibleClasses).sort()).toEqual([...appearances].sort());
      expect(Object.keys(buttonSizeClasses).sort()).toEqual([...sizes].sort());
      expect(Object.keys(buttonIconOnlySizeClasses).sort()).toEqual([...sizes].sort());
    });

    it.each(allClassStrings)('%s uses only theme tokens (no raw colors)', (_name, value) => {
      for (const cls of classesOf(value)) {
        expect(cls).not.toMatch(/\[#[0-9a-f]{3,8}\]/i);
        expect(cls).not.toMatch(/rgba?\(/);
        expect(cls).not.toMatch(/-(white|black)(\/|$)/);
        expect(cls).not.toMatch(
          /-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d/,
        );
      }
    });

    it.each(allClassStrings)('%s never uses the `enabled:` variant', (_name, value) => {
      for (const cls of classesOf(value)) {
        expect(cls).not.toMatch(/(^|:|-)enabled:/);
      }
    });

    it.each(allClassStrings)(
      '%s gates every hover/pressed class with not-disabled:not-aria-disabled:',
      (_name, value) => {
        for (const cls of classesOf(value)) {
          if (/(^|:)hover:/.test(cls)) expect(cls.startsWith(`wave:${HOVER_GATE}`), cls).toBe(true);
          if (/(^|:)active:/.test(cls))
            expect(cls.startsWith(`wave:${ACTIVE_GATE}`), cls).toBe(true);
        }
      },
    );

    it('base classes carry the focus ring, a reduced-motion transition and no underline', () => {
      const base = classesOf(buttonBaseClasses);
      expect(base).toEqual(
        expect.arrayContaining([
          'wave:inline-flex',
          'wave:items-center',
          'wave:justify-center',
          'wave:rounded',
          'wave:font-semibold',
          'wave:no-underline',
          'wave:transition-colors',
          'wave:motion-reduce:transition-none',
          'wave:focus-visible:outline-2',
          'wave:focus-visible:outline-offset-2',
          'wave:focus-visible:outline-ring',
        ]),
      );
    });
  });

  describe('appearance tokens (button-provider#3, #10)', () => {
    it('primary uses the primary fill with hover and pressed tokens (no hard-coded white)', () => {
      expect(classesOf(buttonAppearanceClasses.primary)).toEqual(
        expect.arrayContaining([
          'wave:bg-primary',
          'wave:text-primary-foreground',
          `wave:${HOVER_GATE}bg-primary-hover`,
          `wave:${ACTIVE_GATE}bg-primary-pressed`,
        ]),
      );
    });

    it('outline uses the stroke border and subtle hover/pressed backgrounds', () => {
      expect(classesOf(buttonAppearanceClasses.outline)).toEqual(
        expect.arrayContaining([
          'wave:border',
          'wave:border-stroke',
          'wave:bg-background',
          'wave:text-foreground',
          `wave:${HOVER_GATE}border-stroke-hover`,
          `wave:${HOVER_GATE}bg-subtle-hover`,
          `wave:${ACTIVE_GATE}bg-subtle-pressed`,
        ]),
      );
    });

    it('subtle and transparent are told apart by their text color and hover treatment', () => {
      const subtle = classesOf(buttonAppearanceClasses.subtle);
      const transparent = classesOf(buttonAppearanceClasses.transparent);
      expect(subtle).toEqual(
        expect.arrayContaining([
          'wave:bg-transparent',
          'wave:text-foreground',
          `wave:${HOVER_GATE}bg-subtle-hover`,
          `wave:${ACTIVE_GATE}bg-subtle-pressed`,
        ]),
      );
      expect(subtle).not.toContain('wave:text-primary');
      expect(transparent).toEqual(
        expect.arrayContaining([
          'wave:bg-transparent',
          'wave:text-primary',
          `wave:${HOVER_GATE}underline`,
        ]),
      );
      expect(transparent).not.toContain('wave:text-foreground');
      expect(transparent).not.toContain(`wave:${HOVER_GATE}bg-subtle-hover`);
    });

    it('every appearance draws a 1px border (transparent unless outline) so forced colors show an edge', () => {
      for (const appearance of appearances) {
        expect(classesOf(buttonAppearanceClasses[appearance])).toContain('wave:border');
      }
      for (const appearance of ['primary', 'subtle', 'transparent'] as const) {
        expect(classesOf(buttonAppearanceClasses[appearance])).toContain('wave:border-transparent');
      }
    });

    it('pressed maps use the selected / primary-pressed tokens', () => {
      expect(classesOf(buttonPressedClasses.primary)).toContain('wave:bg-primary-pressed');
      for (const appearance of ['outline', 'subtle', 'transparent'] as const) {
        expect(classesOf(buttonPressedClasses[appearance])).toEqual(
          expect.arrayContaining(['wave:bg-selected', 'wave:text-selected-foreground']),
        );
      }
    });
  });

  describe('sizes (button-provider#19)', () => {
    it('heights grow with the size ramp', () => {
      expect(
        sizes.map((s) => classesOf(buttonSizeClasses[s]).find((c) => /^wave:h-/.test(c))),
      ).toEqual(['wave:h-5', 'wave:h-6', 'wave:h-8', 'wave:h-10', 'wave:h-12']);
    });

    it('font sizes grow strictly with the size ramp (extra-large is larger than large)', () => {
      const px = sizes.map((s) => fontSizeOf(buttonSizeClasses[s]));
      for (let i = 1; i < px.length; i++) {
        expect(px[i], `${sizes[i]} vs ${sizes[i - 1]}`).toBeGreaterThan(px[i - 1]);
      }
      expect(fontSizeOf(buttonSizeClasses['extra-large'])).toBeGreaterThan(
        fontSizeOf(buttonSizeClasses.large),
      );
    });

    it.each(sizes)(
      'the %s font size is px-based like the rest of the ramp, so the order holds at any root font size (button-provider#19)',
      (size) => {
        // A rem size next to px ramp tokens re-inverts the ramp when an app lowers its root font
        // size (text-lg is smaller than the 16px large size below a 14.2px root).
        expect(fontSizeDetailsOf(buttonSizeClasses[size]).unit).toBe('px');
        expect(fontSizeDetailsOf(buttonIconOnlySizeClasses[size]).unit).toBe('px');
      },
    );

    it('extra-large uses 18px text on a 24px line (Fluent base 450; the type ramp has no 18px step)', () => {
      expect(classesOf(buttonSizeClasses['extra-large'])).toContain('wave:text-[18px]/[24px]');
      expect(classesOf(buttonIconOnlySizeClasses['extra-large'])).toContain(
        'wave:text-[18px]/[24px]',
      );
    });

    it('the extra-large font size keeps a consumer text color and yields to a consumer font size', () => {
      const withColor = wcn(buttonClassName({ size: 'extra-large' }), 'text-error');
      expect(classesOf(withColor)).toEqual(
        expect.arrayContaining(['wave:text-[18px]/[24px]', 'text-error']),
      );
      const withFontSize = wcn(buttonClassName({ size: 'extra-large' }), 'text-body-1');
      expect(classesOf(withFontSize)).toContain('text-body-1');
      expect(classesOf(withFontSize)).not.toContain('wave:text-[18px]/[24px]');
    });

    it('icon-only sizes are square with the same font size as the labelled size', () => {
      for (const size of sizes) {
        const cls = classesOf(buttonIconOnlySizeClasses[size]);
        const h = cls.find((c) => /^wave:h-/.test(c));
        const w = cls.find((c) => /^wave:w-/.test(c));
        expect(h, size).toBeDefined();
        expect(w, size).toBe(h?.replace(/^wave:h-/, 'wave:w-'));
        expect(fontSizeOf(buttonIconOnlySizeClasses[size])).toBe(
          fontSizeOf(buttonSizeClasses[size]),
        );
        expect(cls.some((c) => c.startsWith('wave:min-w-'))).toBe(false);
      }
    });
  });

  describe('buttonClassName', () => {
    it('defaults to the outline appearance at medium size', () => {
      const cls = classesOf(buttonClassName());
      expect(cls).toEqual(
        expect.arrayContaining([
          'wave:inline-flex',
          'wave:h-8',
          'wave:min-w-24',
          'wave:text-body-1',
          'wave:border-stroke',
          'wave:text-foreground',
        ]),
      );
      expect(buttonClassName()).toBe(buttonClassName({ appearance: 'outline', size: 'medium' }));
    });

    it.each(appearances)('combines base, size and the %s appearance', (appearance) => {
      const cls = classesOf(buttonClassName({ appearance, size: 'large' }));
      expect(cls).toEqual(
        expect.arrayContaining(['wave:inline-flex', 'wave:h-10', 'wave:text-body-2']),
      );
      for (const token of ['wave:bg-primary', 'wave:bg-background', 'wave:bg-transparent']) {
        expect(cls.includes(token)).toBe(
          classesOf(buttonAppearanceClasses[appearance]).includes(token),
        );
      }
    });

    it('iconOnly renders a square button without the minimum width', () => {
      const cls = classesOf(buttonClassName({ iconOnly: true, size: 'small' }));
      expect(cls).toEqual(expect.arrayContaining(['wave:h-6', 'wave:w-6']));
      expect(cls.some((c) => c.startsWith('wave:min-w-'))).toBe(false);
    });

    it('disabled adds the disabled look, including the forced-colors GrayText', () => {
      const cls = classesOf(buttonClassName({ disabled: true }));
      expect(cls).toEqual(
        expect.arrayContaining([
          'wave:opacity-50',
          'wave:cursor-not-allowed',
          'wave:forced-colors:text-[GrayText]',
          'wave:forced-colors:border-[GrayText]',
        ]),
      );
      expect(classesOf(buttonClassName())).not.toContain('wave:opacity-50');
    });

    it('the disabled look lifts its opacity while a focusable disabled button shows its focus ring', () => {
      // `opacity` dims the element's own outline too: a `disabledFocusable` or consumer
      // `aria-disabled` button keeps a full-strength ring. tailwind-merge keeps both classes
      // (different variants), and the variant's higher specificity wins while focused.
      expect(classesOf(buttonClassName({ disabled: true }))).toEqual(
        expect.arrayContaining(['wave:opacity-50', 'wave:aria-disabled:focus-visible:opacity-100']),
      );
    });

    it('pressed layers the pressed tokens over the appearance (tailwind-merge resolves conflicts)', () => {
      const cls = classesOf(buttonClassName({ appearance: 'outline', pressed: true }));
      expect(cls).toEqual(
        expect.arrayContaining([
          'wave:bg-selected',
          'wave:text-selected-foreground',
          'wave:border-primary',
        ]),
      );
      expect(cls).not.toContain('wave:bg-background');
      expect(cls).not.toContain('wave:text-foreground');
      expect(cls).not.toContain('wave:border-stroke');
      const primary = classesOf(buttonClassName({ appearance: 'primary', pressed: true }));
      expect(primary).toContain('wave:bg-primary-pressed');
      expect(primary).not.toContain('wave:bg-primary');
    });

    it.each(appearances)(
      'pressed %s marks the button with the forced-colors container recipe (Highlight outline and border)',
      (appearance) => {
        const cls = classesOf(buttonClassName({ appearance, pressed: true }));
        expect(cls).toEqual(
          expect.arrayContaining([
            'wave:forced-colors:outline-2',
            'wave:forced-colors:outline-[Highlight]',
            'wave:forced-colors:-outline-offset-2',
            'wave:forced-colors:border-[Highlight]',
          ]),
        );
        // A button is a container: `forced-color-adjust: none` would be inherited by its label,
        // icons and focus ring (forcedColors.selectedLeaf is for leaf indicators only).
        expect(cls.some((c) => c.includes('forced-color-adjust'))).toBe(false);
        expect(cls).not.toContain('wave:forced-colors:bg-[Highlight]');
        expect(cls).not.toContain('wave:forced-colors:text-[HighlightText]');
      },
    );

    it('pressed and disabled uses only GrayText in forced colors (no Highlight next to GrayText)', () => {
      for (const appearance of appearances) {
        const cls = classesOf(buttonClassName({ appearance, pressed: true, disabled: true }));
        expect(cls).toEqual(
          expect.arrayContaining([
            'wave:forced-colors:text-[GrayText]',
            'wave:forced-colors:border-[GrayText]',
            'wave:forced-colors:outline-[GrayText]',
          ]),
        );
        expect(
          cls.filter((c) => c.startsWith('wave:forced-colors:') && c.includes('Highlight')),
          appearance,
        ).toEqual([]);
        expect(cls.some((c) => c.includes('forced-color-adjust'))).toBe(false);
      }
    });

    it('the GrayText outline is added only when pressed and disabled', () => {
      expect(classesOf(buttonClassName({ disabled: true }))).not.toContain(
        'wave:forced-colors:outline-[GrayText]',
      );
      expect(classesOf(buttonClassName({ pressed: true }))).not.toContain(
        'wave:forced-colors:outline-[GrayText]',
      );
    });
  });

  describe('accessible pressed colors (ToggleButton isAccessible)', () => {
    it('draws the pressed state as a brand fill with on-brand text, per appearance', () => {
      expect(classesOf(buttonPressedAccessibleClasses.primary)).toEqual([
        'wave:bg-primary-pressed',
        'wave:text-primary-foreground',
        'wave:inset-ring-2',
        'wave:inset-ring-primary-foreground',
        `wave:${HOVER_GATE}bg-primary-pressed`,
      ]);
      expect(classesOf(buttonPressedAccessibleClasses.outline)).toEqual([
        'wave:border-primary',
        'wave:bg-primary',
        'wave:text-primary-foreground',
        `wave:${HOVER_GATE}border-primary-hover`,
        `wave:${HOVER_GATE}bg-primary-hover`,
        `wave:${ACTIVE_GATE}bg-primary-pressed`,
      ]);
      for (const appearance of ['subtle', 'transparent'] as const) {
        expect(classesOf(buttonPressedAccessibleClasses[appearance]), appearance).toEqual([
          'wave:bg-primary',
          'wave:text-primary-foreground',
          `wave:${HOVER_GATE}bg-primary-hover`,
          `wave:${ACTIVE_GATE}bg-primary-pressed`,
        ]);
      }
    });

    it('buttonClassName({ pressed: true, accessible: true }) layers them over the appearance', () => {
      const outline = classesOf(buttonClassName({ pressed: true, accessible: true }));
      expect(outline).toEqual(
        expect.arrayContaining([
          'wave:border-primary',
          'wave:bg-primary',
          'wave:text-primary-foreground',
          `wave:${HOVER_GATE}border-primary-hover`,
          `wave:${HOVER_GATE}bg-primary-hover`,
          `wave:${ACTIVE_GATE}bg-primary-pressed`,
        ]),
      );
      for (const replaced of [
        'wave:bg-background',
        'wave:text-foreground',
        'wave:border-stroke',
        'wave:bg-selected',
        'wave:text-selected-foreground',
        `wave:${HOVER_GATE}bg-subtle-hover`,
        `wave:${ACTIVE_GATE}bg-subtle-pressed`,
      ]) {
        expect(outline, replaced).not.toContain(replaced);
      }

      const primary = classesOf(
        buttonClassName({ appearance: 'primary', pressed: true, accessible: true }),
      );
      expect(primary).toEqual(
        expect.arrayContaining([
          'wave:bg-primary-pressed',
          'wave:text-primary-foreground',
          'wave:inset-ring-2',
          'wave:inset-ring-primary-foreground',
          `wave:${HOVER_GATE}bg-primary-pressed`,
        ]),
      );
      expect(primary).not.toContain('wave:bg-primary');
      expect(primary).not.toContain(`wave:${HOVER_GATE}bg-primary-hover`);

      const subtle = classesOf(
        buttonClassName({ appearance: 'subtle', pressed: true, accessible: true }),
      );
      expect(subtle).toEqual(
        expect.arrayContaining(['wave:bg-primary', 'wave:text-primary-foreground']),
      );
      expect(subtle).not.toContain('wave:bg-transparent');
      expect(subtle).not.toContain('wave:text-foreground');

      const transparent = classesOf(
        buttonClassName({ appearance: 'transparent', pressed: true, accessible: true }),
      );
      expect(transparent).toEqual(
        expect.arrayContaining(['wave:bg-primary', 'wave:text-primary-foreground']),
      );
      expect(transparent).not.toContain('wave:text-primary');
    });

    it.each(appearances)('accessible changes nothing on an unpressed %s button', (appearance) => {
      expect(buttonClassName({ appearance, accessible: true })).toBe(
        buttonClassName({ appearance }),
      );
      expect(buttonClassName({ appearance, accessible: true, disabled: true })).toBe(
        buttonClassName({ appearance, disabled: true }),
      );
    });

    it.each(appearances)(
      'pressed %s: the forced-colors classes are the same with and without accessible',
      (appearance) => {
        const forced = (value: string) =>
          classesOf(value)
            .filter((c) => c.startsWith('wave:forced-colors:'))
            .sort();
        for (const disabled of [false, true]) {
          expect(
            forced(buttonClassName({ appearance, pressed: true, disabled, accessible: true })),
            `disabled: ${String(disabled)}`,
          ).toEqual(forced(buttonClassName({ appearance, pressed: true, disabled })));
        }
      },
    );

    it.each(appearances)(
      'pressed and disabled %s keeps the disabled look and the GrayText outline',
      (appearance) => {
        const cls = classesOf(
          buttonClassName({ appearance, pressed: true, disabled: true, accessible: true }),
        );
        expect(cls).toEqual(
          expect.arrayContaining([
            'wave:opacity-50',
            'wave:cursor-not-allowed',
            'wave:forced-colors:text-[GrayText]',
            'wave:forced-colors:border-[GrayText]',
            'wave:forced-colors:outline-[GrayText]',
          ]),
        );
        expect(
          cls.filter((c) => c.startsWith('wave:forced-colors:') && c.includes('Highlight')),
        ).toEqual([]);
      },
    );
  });
});
