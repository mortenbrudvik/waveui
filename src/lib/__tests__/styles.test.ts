import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { wcn } from '../cn';
import {
  focusRing,
  focusRingInset,
  focusWithinRing,
  inputBase,
  inputFocus,
  inputFocusWithin,
  inputInvalid,
  inputInvalidWithin,
  inputHeightClasses,
  inputTextClasses,
  inputPaddingClasses,
  inputAppearanceClasses,
  hitAreaLayer,
  disabledStyles,
  forcedColors,
  motionSafeTransition,
} from '../styles';
import { Input } from '../../components/input/Input';

const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);

describe('focus recipes (C-FOCUS, feedback-navigation#24)', () => {
  it('focusRing is the shared focus-visible outline ring', () => {
    expect(tokens(focusRing)).toEqual([
      'wave:focus-visible:outline-2',
      'wave:focus-visible:outline-offset-2',
      'wave:focus-visible:outline-ring',
    ]);
  });

  it('focusRingInset draws the ring inside (cells, rows, list items)', () => {
    expect(tokens(focusRingInset)).toEqual([
      'wave:focus-visible:outline-2',
      'wave:focus-visible:-outline-offset-2',
      'wave:focus-visible:outline-ring',
    ]);
  });

  it('focusWithinRing rings a container while a descendant has focus', () => {
    expect(tokens(focusWithinRing)).toEqual([
      'wave:focus-within:outline-2',
      'wave:focus-within:outline-offset-2',
      'wave:focus-within:outline-ring',
    ]);
  });

  it('no recipe uses outline-none (it removes the forced-colors focus indicator)', () => {
    for (const recipe of [
      focusRing,
      focusRingInset,
      focusWithinRing,
      inputFocus,
      inputFocusWithin,
    ]) {
      expect(recipe).not.toMatch(/outline-none/);
    }
  });
});

describe('input recipes (input-basic#9)', () => {
  it('inputFocus hides the outline only while focused (outline-hidden keeps it in forced colors) and thickens the bottom border', () => {
    expect(tokens(inputFocus)).toEqual([
      'wave:focus:outline-hidden',
      'wave:focus:border-b-2',
      'wave:focus:border-b-primary',
    ]);
  });

  it('inputFocusWithin is the wrapper form of inputFocus', () => {
    expect(tokens(inputFocusWithin)).toEqual([
      'wave:focus-within:border-b-2',
      'wave:focus-within:border-b-primary',
    ]);
  });

  it('inputBase uses tokens only', () => {
    expect(inputBase).toContain('wave:border-input');
    expect(inputBase).toContain('wave:placeholder:text-muted-foreground');
    expect(inputBase).not.toMatch(/#|white|black/);
  });

  it('survives cn() with an error override', () => {
    expect(wcn(inputBase, inputFocus, 'border-destructive')).toContain(
      'wave:focus:border-b-primary',
    );
    expect(wcn(inputBase, inputFocus, 'border-destructive')).toContain('border-destructive');
    expect(wcn(inputBase, inputFocus, 'border-destructive')).not.toContain(' wave:border-input');
  });
});

describe('invalid recipes (Phase 4 D4)', () => {
  it('inputInvalid is the destructive border on every border the appearance draws', () => {
    expect(tokens(inputInvalid)).toEqual(['wave:border-destructive']);
  });

  it('inputInvalidWithin is the wrapper form', () => {
    expect(tokens(inputInvalidWithin)).toEqual(['wave:border-destructive']);
  });

  it('after the base and focus recipes, it recolors the borders and leaves the focused bottom to the focus recipe', () => {
    const merged = tokens(
      wcn(inputBase, 'wave:border-b-stroke-accessible', inputFocus, inputInvalid),
    );
    expect(merged).toContain('wave:border-destructive');
    expect(merged).not.toContain('wave:border-input');
    expect(merged).not.toContain('wave:border-b-stroke-accessible');
    expect(merged).toEqual(
      expect.arrayContaining([
        'wave:focus:outline-hidden',
        'wave:focus:border-b-2',
        'wave:focus:border-b-primary',
      ]),
    );

    const wrapper = tokens(
      wcn('wave:border wave:border-input', inputFocusWithin, inputInvalidWithin),
    );
    expect(wrapper).toEqual(
      expect.arrayContaining(['wave:border-destructive', 'wave:focus-within:border-b-primary']),
    );
    expect(wrapper).not.toContain('wave:border-input');
  });

  it('are the classes Input shows for a resolved aria-invalid today (no visual change on adoption)', () => {
    render(
      createElement('div', null, [
        createElement(Input, { key: 'plain', 'aria-label': 'Plain', 'aria-invalid': true }),
        createElement(Input, {
          key: 'slotted',
          'aria-label': 'Slotted',
          'aria-invalid': true,
          contentBefore: '$',
        }),
      ]),
    );
    expect(screen.getByRole('textbox', { name: 'Plain' })).toHaveClass(...tokens(inputInvalid));
    expect(screen.getByRole('textbox', { name: 'Slotted' }).parentElement).toHaveClass(
      ...tokens(inputInvalidWithin),
    );
  });

  it('use tokens only', () => {
    expect(`${inputInvalid} ${inputInvalidWithin}`).not.toMatch(/#|white|black|red-/);
  });
});

describe('input size and appearance maps (Phase 4 §1.2)', () => {
  it('has one entry per size and per appearance', () => {
    expect(Object.keys(inputHeightClasses)).toEqual(['small', 'medium', 'large']);
    expect(Object.keys(inputTextClasses)).toEqual(['small', 'medium', 'large']);
    expect(Object.keys(inputPaddingClasses)).toEqual(['small', 'medium', 'large']);
    expect(Object.keys(inputAppearanceClasses)).toEqual([
      'outline',
      'underline',
      'filled-darker',
      'filled-lighter',
    ]);
  });

  it('sizes are 24/32/40px tall, caption-1/body-1/body-2 and 8/12/16px padded', () => {
    expect(inputHeightClasses).toEqual({
      small: 'wave:h-6',
      medium: 'wave:h-8',
      large: 'wave:h-10',
    });
    expect(inputTextClasses).toEqual({
      small: 'wave:text-caption-1',
      medium: 'wave:text-body-1',
      large: 'wave:text-body-2',
    });
    expect(inputPaddingClasses).toEqual({
      small: 'wave:px-2',
      medium: 'wave:px-3',
      large: 'wave:px-4',
    });
  });

  it('medium outline composes the 0.7 field classes', () => {
    const classes = tokens(
      wcn(
        inputHeightClasses.medium,
        inputPaddingClasses.medium,
        inputTextClasses.medium,
        inputAppearanceClasses.outline,
      ),
    );
    expect(classes).toEqual(
      expect.arrayContaining([
        'wave:h-8',
        'wave:px-3',
        'wave:text-body-1',
        'wave:rounded',
        'wave:border',
        'wave:border-input',
        'wave:border-b-stroke-accessible',
        'wave:bg-background',
      ]),
    );
  });

  it('underline draws only the bottom stroke, square and unfilled, with a forced-colors boundary', () => {
    expect(tokens(inputAppearanceClasses.underline)).toEqual([
      'wave:rounded-none',
      'wave:border-0',
      'wave:border-b',
      'wave:border-b-stroke-accessible',
      'wave:bg-transparent',
      'wave:forced-colors:border-[ButtonText]',
    ]);
  });

  it.each(['filled-darker', 'filled-lighter'] as const)(
    '%s is a fill with the filled stroke token and a forced-colors boundary',
    (appearance) => {
      expect(tokens(inputAppearanceClasses[appearance])).toEqual([
        'wave:rounded',
        'wave:border',
        'wave:border-input-filled-stroke',
        `wave:bg-input-${appearance}`,
        'wave:forced-colors:border-[ButtonText]',
      ]);
    },
  );

  it('the invalid look recolors the drawn borders of every appearance', () => {
    expect(tokens(wcn(inputAppearanceClasses.underline, inputInvalid))).toEqual(
      expect.arrayContaining(['wave:border-0', 'wave:border-b', 'wave:border-destructive']),
    );
    const filled = tokens(wcn(inputAppearanceClasses['filled-darker'], inputInvalid));
    expect(filled).toContain('wave:border-destructive');
    expect(filled).not.toContain('wave:border-input-filled-stroke');
    const focused = tokens(wcn(inputAppearanceClasses.outline, inputFocus, inputInvalid));
    expect(focused).toEqual(
      expect.arrayContaining(['wave:border-destructive', 'wave:focus:border-b-primary']),
    );
  });

  it('hitAreaLayer extends a 20px box by 2px on every side and does not position it', () => {
    expect(tokens(hitAreaLayer)).toEqual(['wave:before:absolute', 'wave:before:-inset-0.5']);
    expect(tokens(wcn('wave:absolute wave:size-5', hitAreaLayer))).toContain('wave:absolute');
  });
});

describe('disabledStyles', () => {
  it('covers native disabled and aria-disabled (C-DISABLED)', () => {
    expect(disabledStyles).toContain('wave:disabled:cursor-not-allowed');
    expect(disabledStyles).toContain('wave:aria-disabled:cursor-not-allowed');
    expect(disabledStyles).toContain('wave:disabled:opacity-50');
    expect(disabledStyles).toContain('wave:aria-disabled:opacity-50');
  });

  it('lifts the dimmed look of a focusable aria-disabled control while it shows its focus ring', () => {
    // `opacity` dims the element's own outline too, which would put the ring below 3:1. The
    // variant's higher specificity wins over `aria-disabled:opacity-50` while it matches; a
    // natively disabled control never takes focus.
    expect(tokens(disabledStyles)).toEqual([
      'wave:disabled:cursor-not-allowed',
      'wave:disabled:opacity-50',
      'wave:aria-disabled:cursor-not-allowed',
      'wave:aria-disabled:opacity-50',
      'wave:aria-disabled:focus-visible:opacity-100',
    ]);
  });
});

describe('forcedColors recipes (input-basic#9)', () => {
  it('selectedLeaf paints Highlight and opts only the leaf out of forced colors', () => {
    expect(tokens(forcedColors.selectedLeaf)).toEqual([
      'wave:forced-colors:bg-[Highlight]',
      'wave:forced-colors:text-[HighlightText]',
      'wave:forced-colors:forced-color-adjust-none',
    ]);
  });

  it('selectedContainer marks containers with a Highlight outline and never uses forced-color-adjust-none (it inherits)', () => {
    expect(tokens(forcedColors.selectedContainer)).toEqual([
      'wave:forced-colors:outline-2',
      'wave:forced-colors:outline-[Highlight]',
      'wave:forced-colors:-outline-offset-2',
    ]);
    expect(forcedColors.selectedContainer).not.toContain('forced-color-adjust');
  });

  it('control, border and disabled use system colors', () => {
    expect(forcedColors.control).toBe('wave:forced-colors:border-[ButtonText]');
    expect(forcedColors.border).toBe('wave:forced-colors:border-[CanvasText]');
    expect(forcedColors.disabled).toBe(
      'wave:forced-colors:text-[GrayText] wave:forced-colors:border-[GrayText]',
    );
  });

  it('fill keeps a visible Highlight fill: the leaf opts out of forced colors', () => {
    // Without the opt-out the browser replaces the author background with Canvas and the dot or
    // segment disappears.
    expect(tokens(forcedColors.fill)).toEqual([
      'wave:forced-colors:bg-[Highlight]',
      'wave:forced-colors:forced-color-adjust-none',
    ]);
    expect(wcn('wave:bg-stroke-accessible', forcedColors.fill)).toBe(
      `wave:bg-stroke-accessible ${forcedColors.fill}`,
    );
  });

  describe('rangeInput: a native range input drawn by its pseudo-elements', () => {
    it('opts the input out and gives every part it paints a system color, in both engines', () => {
      expect(tokens(forcedColors.rangeInput)).toEqual([
        'wave:forced-colors:forced-color-adjust-none',
        // Rail
        'wave:forced-colors:[&::-webkit-slider-runnable-track]:bg-[CanvasText]',
        'wave:forced-colors:[&::-moz-range-track]:bg-[CanvasText]',
        // Thumb: the value indicator, with a Canvas edge where the thumb crosses the rail
        'wave:forced-colors:[&::-webkit-slider-thumb]:bg-[Highlight]',
        'wave:forced-colors:[&::-webkit-slider-thumb]:border-[Canvas]',
        'wave:forced-colors:[&::-moz-range-thumb]:bg-[Highlight]',
        'wave:forced-colors:[&::-moz-range-thumb]:border-[Canvas]',
        // Disabled: GrayText, the system color of disabled content
        'wave:forced-colors:disabled:[&::-webkit-slider-runnable-track]:bg-[GrayText]',
        'wave:forced-colors:disabled:[&::-moz-range-track]:bg-[GrayText]',
        'wave:forced-colors:disabled:[&::-webkit-slider-thumb]:bg-[GrayText]',
        'wave:forced-colors:disabled:[&::-moz-range-thumb]:bg-[GrayText]',
        // The opt-out also covers the input's own focus outline
        'wave:forced-colors:focus-visible:outline-[Highlight]',
      ]);
    });

    it('never paints a part with an author color once the input is opted out', () => {
      // `forced-color-adjust` is inherited by the pseudo-elements: every color class must name a
      // system color, and every part the Slider colors (rail, thumb fill and edge, focus
      // outline) must get one.
      const systemColor = /-\[(Canvas|CanvasText|Highlight|GrayText)\]$/;
      for (const token of tokens(forcedColors.rangeInput)) {
        expect(token.startsWith('wave:forced-colors:')).toBe(true);
        if (token !== 'wave:forced-colors:forced-color-adjust-none') {
          expect(token).toMatch(systemColor);
        }
      }
      for (const part of [
        '[&::-webkit-slider-runnable-track]:bg-',
        '[&::-moz-range-track]:bg-',
        '[&::-webkit-slider-thumb]:bg-',
        '[&::-webkit-slider-thumb]:border-',
        '[&::-moz-range-thumb]:bg-',
        '[&::-moz-range-thumb]:border-',
        'focus-visible:outline-',
      ]) {
        expect(forcedColors.rangeInput).toContain(`wave:forced-colors:${part}[`);
      }
    });

    it("keeps the Slider's normal-mode rail, thumb and focus classes in cn()", () => {
      const slider = [
        'wave:[&::-webkit-slider-runnable-track]:bg-stroke-accessible',
        'wave:[&::-moz-range-track]:bg-stroke-accessible',
        'wave:[&::-webkit-slider-thumb]:border-background wave:[&::-webkit-slider-thumb]:bg-primary',
        'wave:[&::-moz-range-thumb]:border-background wave:[&::-moz-range-thumb]:bg-primary',
        focusRing,
      ].join(' ');
      expect(wcn(slider, forcedColors.rangeInput)).toBe(`${slider} ${forcedColors.rangeInput}`);
    });
  });

  describe('ringArc: a ring drawn with borders whose top side is the arc', () => {
    it('opts the ring out and draws a Highlight arc on a Canvas track', () => {
      // Forced colors would give all four sides one system color, so the arc would vanish into
      // the track. The track color comes first: `border-t-*` must follow `border-*`.
      expect(tokens(forcedColors.ringArc)).toEqual([
        'wave:forced-colors:forced-color-adjust-none',
        'wave:forced-colors:border-[Canvas]',
        'wave:forced-colors:border-t-[Highlight]',
      ]);
    });

    it("keeps the Spinner's normal-mode ring classes in cn()", () => {
      const ring =
        'wave:rounded-full wave:border-2 wave:border-track wave:border-t-primary wave:animate-wave-spin wave:motion-reduce:animate-wave-spin-slow';
      expect(wcn(ring, forcedColors.ringArc)).toBe(`${ring} ${forcedColors.ringArc}`);
    });
  });

  it('the deprecated `selected` alias is the leaf recipe', () => {
    expect(forcedColors.selected).toBe(forcedColors.selectedLeaf);
  });

  it('recipes do not knock out normal-mode classes in cn()', () => {
    const merged = wcn('wave:bg-primary wave:text-primary-foreground', forcedColors.selectedLeaf);
    expect(merged).toContain('wave:bg-primary');
    expect(merged).toContain('wave:text-primary-foreground');
    expect(wcn(focusRing, forcedColors.selectedContainer)).toBe(
      `${focusRing} ${forcedColors.selectedContainer}`,
    );
  });
});

describe('motionSafeTransition (C-MOTION)', () => {
  it('always carries a motion-reduce variant', () => {
    expect(motionSafeTransition).toMatch(/\btransition\b/);
    expect(motionSafeTransition).toContain('wave:motion-reduce:transition-none');
  });
});
