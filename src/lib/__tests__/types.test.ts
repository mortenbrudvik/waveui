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
  CheckedValues,
  CheckedValuesChangeDetails,
  CheckedValuesChangeHandler,
  PopupRect,
  VirtualElement,
  PopupTarget,
} from '../types';
import type { VirtualElement as FloatingVirtualElement } from '@floating-ui/react-dom';
import type { DismissReason } from '../layers';
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

  it('ModalType is modal or alert', () => {
    expectTypeOf<ModalType>().toEqualTypeOf<'modal' | 'alert'>();
    expectTypeOf<'non-modal'>().not.toMatchTypeOf<ModalType>();
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
