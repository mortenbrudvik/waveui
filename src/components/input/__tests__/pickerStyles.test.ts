import { describe, it, expect } from 'vitest';
import {
  PICKER_ICON_BUTTON_CLASSES,
  pickerButtonOffset,
  pickerEndPadding,
  pickerGlyphSize,
  pickerIconButtonClasses,
} from '../pickerStyles';
import { hitAreaLayer } from '../../../lib/styles';

const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);

describe('picker metrics (Phase 4 D11)', () => {
  it('medium is the 0.7 button, with its literal h-6 w-6 box', () => {
    expect(pickerIconButtonClasses('medium')).toBe(PICKER_ICON_BUTTON_CLASSES);
    expect(tokens(PICKER_ICON_BUTTON_CLASSES)).toEqual(
      expect.arrayContaining(['wave:h-6', 'wave:w-6']),
    );
  });

  it('small is a 20px box with a 24px hit layer; large a 32px box', () => {
    const small = tokens(pickerIconButtonClasses('small'));
    expect(small).toEqual(
      expect.arrayContaining([
        'wave:absolute',
        'wave:size-5',
        'wave:before:absolute',
        'wave:before:-inset-0.5',
      ]),
    );
    expect(small).not.toContain('wave:h-6');
    expect(tokens(pickerIconButtonClasses('large'))).toEqual(
      expect.arrayContaining(['wave:size-8']),
    );
  });

  it('the small box carries the shared hit layer of src/lib/styles', () => {
    expect(tokens(pickerIconButtonClasses('small'))).toEqual(
      expect.arrayContaining(tokens(hitAreaLayer)),
    );
    expect(tokens(pickerIconButtonClasses('medium'))).not.toEqual(
      expect.arrayContaining(tokens(hitAreaLayer)),
    );
  });

  it('on filled-darker the hover fill is one step darker', () => {
    expect(tokens(pickerIconButtonClasses('medium', 'filled-darker'))).toEqual(
      expect.arrayContaining(['wave:not-disabled:not-aria-disabled:hover:bg-subtle-pressed']),
    );
    expect(tokens(pickerIconButtonClasses('medium', 'filled-darker'))).not.toContain(
      'wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover',
    );
  });

  it.each([
    ['small', 'wave:end-1', 'wave:end-7', 'wave:pe-7', 'wave:pe-13'],
    ['medium', 'wave:end-1', 'wave:end-7', 'wave:pe-8', 'wave:pe-14'],
    ['large', 'wave:end-1', 'wave:end-9', 'wave:pe-10', 'wave:pe-18'],
  ] as const)('%s: offsets %s/%s, end paddings %s/%s', (size, first, second, one, two) => {
    expect(pickerButtonOffset(size, 1)).toBe(first);
    expect(pickerButtonOffset(size, 2)).toBe(second);
    expect(pickerEndPadding(1, size)).toBe(one);
    expect(pickerEndPadding(2, size)).toBe(two);
    expect(pickerEndPadding(0, size)).toBeUndefined();
  });

  it('keeps the 0.7 results without a size', () => {
    expect(pickerEndPadding(1)).toBe('wave:pe-8');
    expect(pickerEndPadding(2)).toBe('wave:pe-14');
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
