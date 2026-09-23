import { describe, it, expect } from 'vitest';
import { cn } from '../cn';
import {
  focusRing,
  focusRingInset,
  focusWithinRing,
  inputBase,
  inputFocus,
  inputFocusWithin,
  disabledStyles,
  forcedColors,
  motionSafeTransition,
} from '../styles';

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

  it('control, border, fill and disabled use system colors', () => {
    expect(forcedColors.control).toBe('forced-colors:border-[ButtonText]');
    expect(forcedColors.border).toBe('forced-colors:border-[CanvasText]');
    expect(forcedColors.fill).toBe('forced-colors:bg-[Highlight]');
    expect(forcedColors.disabled).toBe(
      'forced-colors:text-[GrayText] forced-colors:border-[GrayText]',
    );
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
