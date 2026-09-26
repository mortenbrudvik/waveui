import { describe, it, expect } from 'vitest';
import {
  PICKER_ICON_BUTTON_CLASSES,
  pickerButtonOffset,
  pickerEndPadding,
  pickerGlyphSize,
  pickerIconButtonClasses,
} from '../pickerStyles';

const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);

describe('picker metrics (Phase 4 D11)', () => {
  it('medium is the 0.7 button, with its literal h-6 w-6 box', () => {
    expect(pickerIconButtonClasses('medium')).toBe(PICKER_ICON_BUTTON_CLASSES);
    expect(tokens(PICKER_ICON_BUTTON_CLASSES)).toEqual(expect.arrayContaining(['h-6', 'w-6']));
  });

  it('small is a 20px box with a 24px hit layer; large a 32px box', () => {
    const small = tokens(pickerIconButtonClasses('small'));
    expect(small).toEqual(
      expect.arrayContaining(['absolute', 'size-5', 'before:absolute', 'before:-inset-0.5']),
    );
    expect(small).not.toContain('h-6');
    expect(tokens(pickerIconButtonClasses('large'))).toEqual(expect.arrayContaining(['size-8']));
  });

  it('on filled-darker the hover fill is one step darker', () => {
    expect(tokens(pickerIconButtonClasses('medium', 'filled-darker'))).toEqual(
      expect.arrayContaining(['not-disabled:not-aria-disabled:hover:bg-subtle-pressed']),
    );
    expect(tokens(pickerIconButtonClasses('medium', 'filled-darker'))).not.toContain(
      'not-disabled:not-aria-disabled:hover:bg-subtle-hover',
    );
  });

  it.each([
    ['small', 'end-1', 'end-7', 'pe-7', 'pe-13'],
    ['medium', 'end-1', 'end-7', 'pe-8', 'pe-14'],
    ['large', 'end-1', 'end-9', 'pe-10', 'pe-18'],
  ] as const)('%s: offsets %s/%s, end paddings %s/%s', (size, first, second, one, two) => {
    expect(pickerButtonOffset(size, 1)).toBe(first);
    expect(pickerButtonOffset(size, 2)).toBe(second);
    expect(pickerEndPadding(1, size)).toBe(one);
    expect(pickerEndPadding(2, size)).toBe(two);
    expect(pickerEndPadding(0, size)).toBeUndefined();
  });

  it('keeps the 0.7 results without a size', () => {
    expect(pickerEndPadding(1)).toBe('pe-8');
    expect(pickerEndPadding(2)).toBe('pe-14');
  });

  it.each([
    ['small', 12, 12],
    ['medium', 12, 16],
    ['large', 16, 20],
  ] as const)('%s glyphs: chevron %i, icons %i', (size, chevron, icon) => {
    expect(pickerGlyphSize(size, 'chevron')).toBe(chevron);
    expect(pickerGlyphSize(size, 'icon')).toBe(icon);
  });
});
