import * as React from 'react';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import type { Shape, Size } from '../../lib/types';

/*
 * The context a `SwatchPicker` gives the swatches it renders (`ColorSwatch` and, from a later
 * package, `ImageSwatch` and `EmptySwatch`): the selected value, how to select, the picker's
 * appearance and focus behaviour, and the duplicate-value registry (D18). Internal; imports no
 * component.
 */

/** Size of the swatches (0.10: `'extra-small'` joins in a later package of this phase). */
export type SwatchPickerSize = Extract<Size, 'small' | 'medium' | 'large'>;

/** The state and behaviour a `SwatchPicker` gives the swatches it renders (D18). */
export interface SwatchPickerContextValue {
  /** The selected value (`''` for none). */
  value: string;
  /** Selects `value` (through the picker's `useControllable` setter: fires only on change). */
  select: (value: string) => void;
  /** @default the picker's `size` prop */
  size: SwatchPickerSize;
  /** @default the picker's `shape` prop */
  shape: Shape;
  /** @default 'row' */
  layout: 'row' | 'grid';
  /** @default 'arrow' */
  focusMode: 'arrow' | 'tab';
  /** @default 'medium' */
  spacing: 'small' | 'medium';
  /** `0` for the swatch that holds the tab stop, `-1` for every other one. */
  getTabIndex: (value: string) => 0 | -1;
  /**
   * Counts a mounted swatch's `value` for the picker's lifetime; a second registration of the same
   * value warns once (C-DEV). Call it from the swatch's layout effect and call the returned
   * remover in that effect's cleanup.
   */
  register: (value: string) => () => void;
}

/** Internal: read with {@link useSwatchPickerContext}, never directly. */
export const SwatchPickerContext = React.createContext<SwatchPickerContextValue | null>(null);

const noop = () => {};

/**
 * An inert picker: nothing is selected, nothing can be, and a swatch's own value is never
 * registered. Used outside a `SwatchPicker` in production, after {@link reportMissingContext} logs
 * once.
 */
const INERT_CONTEXT: SwatchPickerContextValue = {
  value: '',
  select: noop,
  size: 'medium',
  shape: 'circular',
  layout: 'row',
  focusMode: 'arrow',
  spacing: 'medium',
  getTabIndex: () => -1,
  register: () => noop,
};

/**
 * The context of the nearest `SwatchPicker` (C-CONTEXT). Throws in development when `component`
 * renders outside one; in production logs once (`reportMissingContext`) and returns the inert
 * value above.
 *
 * @param component The part reading the context, e.g. `'ColorSwatch'`.
 */
export function useSwatchPickerContext(component: string): SwatchPickerContextValue {
  const context = React.useContext(SwatchPickerContext);
  if (context) return context;
  reportMissingContext(component, 'SwatchPicker');
  return INERT_CONTEXT;
}

/** The warning for two swatches of one picker sharing a value. */
function duplicateValueMessage(value: string): string {
  return (
    `SwatchPicker: several swatches share the value "${value}". Swatch values must be unique; ` +
    'only the first one can be selected.'
  );
}

/**
 * The `register` function of one `SwatchPicker`: a count per swatch value (a `Map<string, number>`
 * kept in a ref, for the picker's lifetime). A second registration of the same value warns once
 * (`SwatchPicker:duplicate-value:<value>`, development only, through {@link warnOnce}).
 *
 * Internal (`SwatchPicker`'s root, which puts the result on its context value).
 */
export function useSwatchRegistry(): SwatchPickerContextValue['register'] {
  const counts = React.useRef<Map<string, number> | null>(null);
  if (counts.current === null) counts.current = new Map();

  return React.useCallback((value: string) => {
    const map = counts.current!;
    const count = (map.get(value) ?? 0) + 1;
    map.set(value, count);
    if (count > 1) {
      warnOnce(`SwatchPicker:duplicate-value:${value}`, duplicateValueMessage(value));
    }
    return () => {
      const remaining = (map.get(value) ?? 1) - 1;
      if (remaining > 0) map.set(value, remaining);
      else map.delete(value);
    };
  }, []);
}
