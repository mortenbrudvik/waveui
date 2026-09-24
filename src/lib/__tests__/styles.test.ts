import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { cn } from '../cn';
import {
  focusRing,
  focusRingInset,
  focusWithinRing,
  inputBase,
  inputFocus,
  inputFocusWithin,
  inputInvalid,
  inputInvalidWithin,
  disabledStyles,
  forcedColors,
  motionSafeTransition,
} from '../styles';
import { Input } from '../../components/input/Input';

const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);

describe('focus recipes (C-FOCUS, feedback-navigation#24)', () => {
  it('focusRing is the shared focus-visible outline ring', () => {
    expect(tokens(focusRing)).toEqual([
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-ring',
    ]);
  });

  it('focusRingInset draws the ring inside (cells, rows, list items)', () => {
    expect(tokens(focusRingInset)).toEqual([
      'focus-visible:outline-2',
      'focus-visible:-outline-offset-2',
      'focus-visible:outline-ring',
    ]);
  });

  it('focusWithinRing rings a container while a descendant has focus', () => {
    expect(tokens(focusWithinRing)).toEqual([
      'focus-within:outline-2',
      'focus-within:outline-offset-2',
      'focus-within:outline-ring',
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
      'focus:outline-hidden',
      'focus:border-b-2',
      'focus:border-b-primary',
    ]);
  });

  it('inputFocusWithin is the wrapper form of inputFocus', () => {
    expect(tokens(inputFocusWithin)).toEqual([
      'focus-within:border-b-2',
      'focus-within:border-b-primary',
    ]);
  });

  it('inputBase uses tokens only', () => {
    expect(inputBase).toContain('border-input');
    expect(inputBase).toContain('placeholder:text-muted-foreground');
    expect(inputBase).not.toMatch(/#|white|black/);
  });

  it('survives cn() with an error override', () => {
    expect(cn(inputBase, inputFocus, 'border-destructive')).toContain('focus:border-b-primary');
    expect(cn(inputBase, inputFocus, 'border-destructive')).toContain('border-destructive');
    expect(cn(inputBase, inputFocus, 'border-destructive')).not.toContain(' border-input');
  });
});

describe('invalid recipes (R8)', () => {
  it('inputInvalid is the destructive border, kept on the focused bottom stroke', () => {
    expect(tokens(inputInvalid)).toEqual(['border-destructive', 'focus:border-b-destructive']);
  });

  it('inputInvalidWithin is the wrapper form (the inner control has the focus)', () => {
    expect(tokens(inputInvalidWithin)).toEqual([
      'border-destructive',
      'focus-within:border-b-destructive',
    ]);
  });

  it('placed after the base and focus recipes, it replaces their border colours', () => {
    const merged = tokens(cn(inputBase, 'border-b-stroke-accessible', inputFocus, inputInvalid));
    expect(merged).toEqual(expect.arrayContaining(tokens(inputInvalid)));
    expect(merged).not.toContain('border-input');
    expect(merged).not.toContain('border-b-stroke-accessible');
    expect(merged).not.toContain('focus:border-b-primary');
    expect(merged).toEqual(expect.arrayContaining(['focus:outline-hidden', 'focus:border-b-2']));

    const wrapper = tokens(cn('border border-input', inputFocusWithin, inputInvalidWithin));
    expect(wrapper).not.toContain('focus-within:border-b-primary');
    expect(wrapper).toEqual(expect.arrayContaining(tokens(inputInvalidWithin)));
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

describe('disabledStyles', () => {
  it('covers native disabled and aria-disabled (C-DISABLED)', () => {
    expect(disabledStyles).toContain('disabled:cursor-not-allowed');
    expect(disabledStyles).toContain('aria-disabled:cursor-not-allowed');
    expect(disabledStyles).toContain('disabled:opacity-50');
    expect(disabledStyles).toContain('aria-disabled:opacity-50');
  });
});

describe('forcedColors recipes (input-basic#9)', () => {
  it('selectedLeaf paints Highlight and opts only the leaf out of forced colors', () => {
    expect(tokens(forcedColors.selectedLeaf)).toEqual([
      'forced-colors:bg-[Highlight]',
      'forced-colors:text-[HighlightText]',
      'forced-colors:forced-color-adjust-none',
    ]);
  });

  it('selectedContainer marks containers with a Highlight outline and never uses forced-color-adjust-none (it inherits)', () => {
    expect(tokens(forcedColors.selectedContainer)).toEqual([
      'forced-colors:outline-2',
      'forced-colors:outline-[Highlight]',
      'forced-colors:-outline-offset-2',
    ]);
    expect(forcedColors.selectedContainer).not.toContain('forced-color-adjust');
  });

  it('control, border and disabled use system colors', () => {
    expect(forcedColors.control).toBe('forced-colors:border-[ButtonText]');
    expect(forcedColors.border).toBe('forced-colors:border-[CanvasText]');
    expect(forcedColors.disabled).toBe(
      'forced-colors:text-[GrayText] forced-colors:border-[GrayText]',
    );
  });

  it('fill keeps a visible Highlight fill: the leaf opts out of forced colors (x-styling-4)', () => {
    // Without the opt-out the browser replaces the author background with Canvas and the dot or
    // segment disappears.
    expect(tokens(forcedColors.fill)).toEqual([
      'forced-colors:bg-[Highlight]',
      'forced-colors:forced-color-adjust-none',
    ]);
    expect(cn('bg-stroke-accessible', forcedColors.fill)).toBe(
      `bg-stroke-accessible ${forcedColors.fill}`,
    );
  });

  describe('rangeInput: a native range input drawn by its pseudo-elements (x-styling-4, R1-1)', () => {
    it('opts the input out and gives every part it paints a system color, in both engines', () => {
      expect(tokens(forcedColors.rangeInput)).toEqual([
        'forced-colors:forced-color-adjust-none',
        // Rail
        'forced-colors:[&::-webkit-slider-runnable-track]:bg-[CanvasText]',
        'forced-colors:[&::-moz-range-track]:bg-[CanvasText]',
        // Thumb: the value indicator, with a Canvas edge where the thumb crosses the rail
        'forced-colors:[&::-webkit-slider-thumb]:bg-[Highlight]',
        'forced-colors:[&::-webkit-slider-thumb]:border-[Canvas]',
        'forced-colors:[&::-moz-range-thumb]:bg-[Highlight]',
        'forced-colors:[&::-moz-range-thumb]:border-[Canvas]',
        // Disabled: GrayText, the system color of disabled content
        'forced-colors:disabled:[&::-webkit-slider-runnable-track]:bg-[GrayText]',
        'forced-colors:disabled:[&::-moz-range-track]:bg-[GrayText]',
        'forced-colors:disabled:[&::-webkit-slider-thumb]:bg-[GrayText]',
        'forced-colors:disabled:[&::-moz-range-thumb]:bg-[GrayText]',
        // The opt-out also covers the input's own focus outline
        'forced-colors:focus-visible:outline-[Highlight]',
      ]);
    });

    it('never paints a part with an author color once the input is opted out', () => {
      // `forced-color-adjust` is inherited by the pseudo-elements: every color class must name a
      // system color, and every part the Slider colors (rail, thumb fill and edge, focus
      // outline) must get one.
      const systemColor = /-\[(Canvas|CanvasText|Highlight|GrayText)\]$/;
      for (const token of tokens(forcedColors.rangeInput)) {
        expect(token.startsWith('forced-colors:')).toBe(true);
        if (token !== 'forced-colors:forced-color-adjust-none') expect(token).toMatch(systemColor);
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
        expect(forcedColors.rangeInput).toContain(`forced-colors:${part}[`);
      }
    });

    it("keeps the Slider's normal-mode rail, thumb and focus classes in cn()", () => {
      const slider = [
        '[&::-webkit-slider-runnable-track]:bg-stroke-accessible',
        '[&::-moz-range-track]:bg-stroke-accessible',
        '[&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary',
        '[&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary',
        focusRing,
      ].join(' ');
      expect(cn(slider, forcedColors.rangeInput)).toBe(`${slider} ${forcedColors.rangeInput}`);
    });
  });

  describe('ringArc: a ring drawn with borders whose top side is the arc (x-styling-4, R1-1)', () => {
    it('opts the ring out and draws a Highlight arc on a Canvas track', () => {
      // Forced colors would give all four sides one system color, so the arc would vanish into
      // the track. The track color comes first: `border-t-*` must follow `border-*`.
      expect(tokens(forcedColors.ringArc)).toEqual([
        'forced-colors:forced-color-adjust-none',
        'forced-colors:border-[Canvas]',
        'forced-colors:border-t-[Highlight]',
      ]);
    });

    it("keeps the Spinner's normal-mode ring classes in cn()", () => {
      const ring =
        'rounded-full border-2 border-track border-t-primary animate-wave-spin motion-reduce:animate-wave-spin-slow';
      expect(cn(ring, forcedColors.ringArc)).toBe(`${ring} ${forcedColors.ringArc}`);
    });
  });

  it('the deprecated `selected` alias is the leaf recipe', () => {
    expect(forcedColors.selected).toBe(forcedColors.selectedLeaf);
  });

  it('recipes do not knock out normal-mode classes in cn()', () => {
    const merged = cn('bg-primary text-primary-foreground', forcedColors.selectedLeaf);
    expect(merged).toContain('bg-primary');
    expect(merged).toContain('text-primary-foreground');
    expect(cn(focusRing, forcedColors.selectedContainer)).toBe(
      `${focusRing} ${forcedColors.selectedContainer}`,
    );
  });
});

describe('motionSafeTransition (C-MOTION)', () => {
  it('always carries a motion-reduce variant', () => {
    expect(motionSafeTransition).toMatch(/\btransition\b/);
    expect(motionSafeTransition).toContain('motion-reduce:transition-none');
  });
});
