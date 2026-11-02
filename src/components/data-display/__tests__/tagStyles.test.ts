import { describe, expect, it } from 'vitest';
import type { TagAppearance, TagShape, TagSize } from '../../../lib/types';
import { TAG_AVATAR_SIZE, tagRootClasses } from '../tagStyles';

const SIZES: readonly TagSize[] = ['medium', 'small', 'extra-small'];
const APPEARANCES: readonly TagAppearance[] = ['filled', 'outline', 'brand'];
const SHAPES: readonly TagShape[] = ['circular', 'rounded'];

/** Height, gap and type, then the insets of a text-only tag (D21; every inset holds the border). */
const SIZE_CLASSES: Record<TagSize, readonly string[]> = {
  medium: ['wave:min-h-7', 'wave:gap-1', 'wave:text-body-1', 'wave:ps-2.75', 'wave:pe-2.75'],
  small: ['wave:min-h-6', 'wave:gap-1', 'wave:text-caption-1', 'wave:ps-1.75', 'wave:pe-1.75'],
  'extra-small': [
    'wave:min-h-5',
    'wave:gap-0.5',
    'wave:text-caption-1',
    'wave:ps-1.75',
    'wave:pe-1.75',
  ],
};

/** The look of each appearance (D22): tokens only, a 1px border on every one. */
const LOOK_CLASSES: Record<TagAppearance, readonly string[]> = {
  filled: ['wave:border-transparent', 'wave:bg-muted', 'wave:text-foreground'],
  outline: ['wave:border-stroke', 'wave:bg-transparent', 'wave:text-foreground'],
  brand: ['wave:border-transparent', 'wave:bg-selected', 'wave:text-selected-foreground'],
};

const SHAPE_CLASSES: Record<TagShape, string> = {
  circular: 'wave:rounded-full',
  rounded: 'wave:rounded',
};

const RAW_COLOR =
  /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black)\b|-(?:gray|grey|slate|zinc|neutral|blue|red)-\d/i;

describe('tagStyles', () => {
  describe.each(SIZES)('size %s', (size) => {
    it.each(
      APPEARANCES.flatMap((appearance) => SHAPES.map((shape) => [appearance, shape] as const)),
    )('tagRootClasses gives the root look of a text-only tag (%s, %s)', (appearance, shape) => {
      const classes = tagRootClasses({ size, appearance, shape }).split(' ');
      expect([...classes].sort()).toEqual(
        [
          'wave:inline-flex',
          'wave:items-center',
          'wave:border',
          ...SIZE_CLASSES[size],
          ...LOOK_CLASSES[appearance],
          SHAPE_CLASSES[shape],
        ].sort(),
      );
      // No stable class (Phase 3 D4): the TagPicker chip that reads it carries its own.
      expect(classes.some((name) => name.startsWith('wave-'))).toBe(false);
      // Tokens only (C-TOKENS).
      expect(classes.join(' ')).not.toMatch(RAW_COLOR);
    });
  });

  it('keeps the size table in the order of the root, size, insets, look and shape', () => {
    expect(tagRootClasses({ size: 'medium', appearance: 'filled', shape: 'circular' })).toBe(
      'wave:inline-flex wave:items-center wave:border wave:min-h-7 wave:gap-1 wave:text-body-1 wave:ps-2.75 wave:pe-2.75 wave:border-transparent wave:bg-muted wave:text-foreground wave:rounded-full',
    );
  });

  it('gives an Avatar in media a 24, 20 or 16px box per tag size', () => {
    expect(TAG_AVATAR_SIZE).toEqual({ medium: 24, small: 20, 'extra-small': 16 });
  });
});
