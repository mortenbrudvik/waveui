import type * as React from 'react';
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
  IconPosition,
  ValidationState,
  LabelPosition,
  OpenChangeDetails,
  ModalOpenChangeReason,
  ModalType,
  SurfaceSize,
  BackdropAppearance,
  HeadingLevel,
  FocusMode,
  TagSize,
  TagAppearance,
  TagShape,
  CheckedValues,
  CheckedValuesChangeDetails,
  CheckedValuesChangeHandler,
  PopupRect,
  VirtualElement,
  PopupTarget,
  CoreSize,
  InputAppearance,
  ColorPickerShape,
  HsvColor,
  DayOfWeek,
  FirstWeekOfYear,
  MotionSlot,
  MotionPreference,
} from '../types';
import type { VirtualElement as FloatingVirtualElement } from '@floating-ui/react-dom';
import type { DismissReason } from '../layers';
import type { AccordionHeadingLevel } from '../../components/layout/Accordion';
import type { SwatchPickerProps } from '../../components/input/SwatchPicker';
import type { SwatchPickerContextValue } from '../../components/input/SwatchPicker.context';
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
    expectTypeOf<TextWeight>().toEqualTypeOf<'regular' | 'medium' | 'semibold' | 'bold'>();
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

describe('icon, label and validation vocabulary', () => {
  it('IconPosition is the inline start or end of a label', () => {
    expectTypeOf<IconPosition>().toEqualTypeOf<'before' | 'after'>();
    expectTypeOf<'start'>().not.toMatchTypeOf<IconPosition>();
  });

  it('ValidationState has the four Field message states', () => {
    expectTypeOf<ValidationState>().toEqualTypeOf<'none' | 'error' | 'warning' | 'success'>();
  });

  it('LabelPosition has the four sides; components narrow it with Extract', () => {
    expectTypeOf<LabelPosition>().toEqualTypeOf<'before' | 'after' | 'above' | 'below'>();
    expectTypeOf<Extract<LabelPosition, 'before' | 'after'>>().toEqualTypeOf<'before' | 'after'>();
  });
});

describe('open-change vocabulary', () => {
  it('OpenChangeDetails carries the reason and the DOM event', () => {
    expectTypeOf<OpenChangeDetails<'escape'>>().toEqualTypeOf<{
      reason: 'escape';
      event: Event;
    }>();
    expectTypeOf<OpenChangeDetails['reason']>().toEqualTypeOf<string>();
    expectTypeOf<OpenChangeDetails['event']>().toEqualTypeOf<Event>();
  });

  it('ModalOpenChangeReason lists the Dialog and Drawer reasons', () => {
    expectTypeOf<ModalOpenChangeReason>().toEqualTypeOf<
      'trigger' | 'close' | 'close-button' | 'escape' | 'outside-press'
    >();
  });

  it('ModalOpenChangeReason includes every modal dismiss reason of the layer stack', () => {
    expectTypeOf<Exclude<DismissReason, 'focus-outside'>>().toMatchTypeOf<ModalOpenChangeReason>();
  });

  it('ModalType is modal, alert or non-modal', () => {
    expectTypeOf<ModalType>().toEqualTypeOf<'modal' | 'alert' | 'non-modal'>();
  });
});

describe('overlay surface vocabulary (Dialog, Drawer, NavDrawer)', () => {
  it('SurfaceSize is the core sizes and full', () => {
    expectTypeOf<SurfaceSize>().toEqualTypeOf<'small' | 'medium' | 'large' | 'full'>();
    expectTypeOf<CoreSize>().toExtend<SurfaceSize>();
    expectTypeOf<'extra-large'>().not.toMatchTypeOf<SurfaceSize>();
  });

  it('BackdropAppearance is dimmed or transparent', () => {
    expectTypeOf<BackdropAppearance>().toEqualTypeOf<'dimmed' | 'transparent'>();
  });
});

describe('heading and focus vocabulary', () => {
  it('HeadingLevel is 1 to 6, and AccordionHeadingLevel is it', () => {
    expectTypeOf<HeadingLevel>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6>();
    expectTypeOf<AccordionHeadingLevel>().toEqualTypeOf<HeadingLevel>();
    expectTypeOf<7>().not.toMatchTypeOf<HeadingLevel>();
  });

  it("FocusMode is tab or arrow, and SwatchPicker's focusMode is it", () => {
    expectTypeOf<FocusMode>().toEqualTypeOf<'tab' | 'arrow'>();
    expectTypeOf<NonNullable<SwatchPickerProps['focusMode']>>().toEqualTypeOf<FocusMode>();
    expectTypeOf<SwatchPickerContextValue['focusMode']>().toEqualTypeOf<FocusMode>();
  });
});

describe('tag vocabulary (Tag, TagGroup, InteractionTag, TagPicker)', () => {
  it('TagSize is extra-small, small and medium, a subset of Size', () => {
    expectTypeOf<TagSize>().toEqualTypeOf<'extra-small' | 'small' | 'medium'>();
    expectTypeOf<TagSize>().toExtend<Size>();
    expectTypeOf<'large'>().not.toMatchTypeOf<TagSize>();
  });

  it('TagAppearance is filled, outline and brand', () => {
    expectTypeOf<TagAppearance>().toEqualTypeOf<'filled' | 'outline' | 'brand'>();
  });

  it('TagShape is the rounded and circular subset of Shape', () => {
    expectTypeOf<TagShape>().toEqualTypeOf<'rounded' | 'circular'>();
    expectTypeOf<TagShape>().toExtend<Shape>();
    expectTypeOf<'square'>().not.toMatchTypeOf<TagShape>();
  });
});

describe('checked-values vocabulary (Menu, Toolbar)', () => {
  it('CheckedValues maps group names to readonly value lists', () => {
    expectTypeOf<CheckedValues>().toEqualTypeOf<Readonly<Record<string, readonly string[]>>>();
    expectTypeOf<Record<string, string[]>>().toExtend<CheckedValues>();
    const literal = { view: ['grid'] } as const;
    expectTypeOf(literal).toExtend<CheckedValues>();
    // @ts-expect-error the values are lists of strings
    const numbers: CheckedValues = { view: [1] };
    expect(numbers).toEqual({ view: [1] });
  });

  it('CheckedValuesChangeDetails carries the group name, its new items and the event', () => {
    expectTypeOf<CheckedValuesChangeDetails>().toEqualTypeOf<{
      name: string;
      checkedItems: string[];
      event: Event;
    }>();
  });

  it('CheckedValuesChangeHandler takes the values first and optional details', () => {
    expectTypeOf<CheckedValuesChangeHandler>().toEqualTypeOf<
      (checkedValues: Record<string, string[]>, details?: CheckedValuesChangeDetails) => void
    >();
    // A handler that reads only the values, and a state setter, are handlers.
    expectTypeOf<
      (values: Record<string, string[]>) => void
    >().toExtend<CheckedValuesChangeHandler>();
    expectTypeOf<
      React.Dispatch<React.SetStateAction<Record<string, string[]>>>
    >().toExtend<CheckedValuesChangeHandler>();
  });
});

describe('popup anchors (Menu.Popover and Popover target)', () => {
  it('PopupRect is a viewport rectangle; a DOMRect is one', () => {
    expectTypeOf<PopupRect>().toEqualTypeOf<{
      x: number;
      y: number;
      width: number;
      height: number;
      top: number;
      right: number;
      bottom: number;
      left: number;
    }>();
    expectTypeOf<DOMRect>().toExtend<PopupRect>();
  });

  it('VirtualElement reads its rectangle on demand, with an optional context element', () => {
    expectTypeOf<VirtualElement['getBoundingClientRect']>().toEqualTypeOf<() => PopupRect>();
    expectTypeOf<VirtualElement['contextElement']>().toEqualTypeOf<Element | undefined>();
    // An element is a VirtualElement too, and floating-ui takes one without a cast.
    expectTypeOf<HTMLElement>().toExtend<VirtualElement>();
    expectTypeOf<VirtualElement>().toExtend<FloatingVirtualElement>();
    // @ts-expect-error a VirtualElement needs getBoundingClientRect
    const noRect: VirtualElement = { contextElement: document.body };
    expect(noRect).toBeDefined();
  });

  it('PopupTarget is an element, a VirtualElement or null', () => {
    expectTypeOf<PopupTarget>().toEqualTypeOf<HTMLElement | VirtualElement | null>();
  });
});

describe('date vocabulary (Calendar, DatePicker)', () => {
  it('DayOfWeek numbers the days as Date.prototype.getDay() does', () => {
    expectTypeOf<DayOfWeek>().toEqualTypeOf<0 | 1 | 2 | 3 | 4 | 5 | 6>();
  });

  it('FirstWeekOfYear names the three rules for week 1 of a year', () => {
    expectTypeOf<FirstWeekOfYear>().toEqualTypeOf<
      'first-day' | 'first-full-week' | 'first-four-day-week'
    >();
  });
});

describe('CoreSize and InputAppearance (Phase 4 D3, D4)', () => {
  it('CoreSize is the three field sizes, a subset of Size', () => {
    expectTypeOf<CoreSize>().toEqualTypeOf<'small' | 'medium' | 'large'>();
    expectTypeOf<CoreSize>().toExtend<Size>();
  });

  it('InputAppearance has the four appearances', () => {
    expectTypeOf<InputAppearance>().toEqualTypeOf<
      'outline' | 'underline' | 'filled-darker' | 'filled-lighter'
    >();
  });
});

describe('color vocabulary (P3-05)', () => {
  it("HsvColor has a hue, a saturation, a value and an optional alpha (Fluent's HsvColor)", () => {
    expectTypeOf<HsvColor>().toEqualTypeOf<{ h: number; s: number; v: number; a?: number }>();
  });

  it('ColorPickerShape is the rounded and square subset of Shape', () => {
    expectTypeOf<ColorPickerShape>().toEqualTypeOf<'rounded' | 'square'>();
    expectTypeOf<ColorPickerShape>().toExtend<Shape>();
    expectTypeOf<'circular'>().not.toMatchTypeOf<ColorPickerShape>();
  });
});

describe('motion types (Phase 10)', () => {
  it('MotionSlot is a class string or { className }', () => {
    expectTypeOf<'x'>().toExtend<MotionSlot>();
    expectTypeOf<{ className: string }>().toExtend<MotionSlot>();
    // @ts-expect-error an empty object is not a slot
    const empty: MotionSlot = {};
    expect(empty).toEqual({});
  });

  it('MotionPreference is "default" or "none"', () => {
    expectTypeOf<MotionPreference>().toEqualTypeOf<'default' | 'none'>();
    // @ts-expect-error 'reduced' is not a preference
    const reduced: MotionPreference = 'reduced';
    expect(reduced).toBe('reduced');
  });
});
