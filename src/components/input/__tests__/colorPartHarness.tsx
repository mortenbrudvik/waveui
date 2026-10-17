import * as React from 'react';
import { hsvToHex } from '../../../lib/color';
import type { ColorPickerShape, HsvColor } from '../../../lib/types';
import {
  ColorPickerContext,
  DEFAULT_COLOR_PICKER_LABELS,
  type ColorPickerContextValue,
  type ColorPickerLabels,
} from '../ColorPicker.parts';
import { parseHexColor } from '../colorUtils';

/** Props of {@link PickerHarness}. */
export interface PickerHarnessProps {
  children: React.ReactNode;
  /** The working color it starts with. */
  initial?: HsvColor;
  shape?: ColorPickerShape;
  labels?: ColorPickerLabels;
  disabled?: boolean;
  /** Called with every color a bound part writes. */
  onHsvChange?: (hsv: HsvColor) => void;
}

const noop = () => {};

/**
 * Test-only stand-in for ColorPicker's context: the working color lives in state, so a bound
 * part reads back what it writes. The picker-only fields are inert.
 */
export function PickerHarness({
  children,
  initial = { h: 0, s: 1, v: 1 },
  shape = 'rounded',
  labels,
  disabled = false,
  onHsvChange,
}: PickerHarnessProps) {
  const [hsv, setHsv] = React.useState(initial);
  const value = React.useMemo<ColorPickerContextValue>(() => {
    const color = hsvToHex(hsv);
    return {
      hsv,
      setHsv: (next) => {
        setHsv(next);
        onHsvChange?.(next);
      },
      color,
      parsed: parseHexColor(color),
      setColor: noop,
      pickPreset: noop,
      presetItems: [],
      shape,
      labels: { ...DEFAULT_COLOR_PICKER_LABELS, ...labels },
      disabled,
      draftResetKey: 0,
      field: null,
      groupInvalid: undefined,
      errorMessageId: undefined,
      registerHexInput: noop,
    };
  }, [hsv, shape, labels, disabled, onHsvChange]);
  return <ColorPickerContext.Provider value={value}>{children}</ColorPickerContext.Provider>;
}
