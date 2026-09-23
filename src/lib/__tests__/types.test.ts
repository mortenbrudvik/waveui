import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  Orientation,
  SelectionMode,
  TextWeight,
  Shape,
  PopupSide,
  PopupAlign,
  Size,
  Appearance,
  TypographyVariant,
} from '../types';
import * as TypesModule from '../types';
import { resolveSlot, renderSlot } from '../slot';

describe('shared vocabulary (layout#16, data-display#30)', () => {
  it('Orientation', () => {
    expectTypeOf<Orientation>().toEqualTypeOf<'horizontal' | 'vertical'>();
  });

  it('SelectionMode uses "multiple" (not "multi")', () => {
    expectTypeOf<SelectionMode>().toEqualTypeOf<'single' | 'multiple'>();
    expectTypeOf<'multi'>().not.toMatchTypeOf<SelectionMode>();
  });

  it('TextWeight is the word vocabulary shared by Text and Label', () => {
    expectTypeOf<TextWeight>().toEqualTypeOf<'regular' | 'semibold' | 'bold'>();
    expectTypeOf<600>().not.toMatchTypeOf<TextWeight>();
  });

  it('Shape describes geometry', () => {
    expectTypeOf<Shape>().toEqualTypeOf<'circular' | 'square' | 'rounded'>();
  });

  it('PopupSide and PopupAlign', () => {
    expectTypeOf<PopupSide>().toEqualTypeOf<
      'top' | 'bottom' | 'start' | 'end' | 'left' | 'right'
    >();
    expectTypeOf<PopupAlign>().toEqualTypeOf<'start' | 'center' | 'end'>();
  });

  it('keeps the 0.4 types unchanged', () => {
    expectTypeOf<Size>().toEqualTypeOf<
      'extra-small' | 'small' | 'medium' | 'large' | 'extra-large'
    >();
    expectTypeOf<Appearance>().toEqualTypeOf<'primary' | 'outline' | 'subtle' | 'transparent'>();
    expectTypeOf<TypographyVariant>().toMatchTypeOf<string>();
  });

  it('still re-exports the slot helpers as values (0.4 compatibility)', () => {
    expect(TypesModule.resolveSlot).toBe(resolveSlot);
    expect(TypesModule.renderSlot).toBe(renderSlot);
  });
});
