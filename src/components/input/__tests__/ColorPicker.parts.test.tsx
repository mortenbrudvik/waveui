import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_PART_COLOR, useColorPartState } from '../ColorPicker.parts';
import { PickerHarness } from './colorPartHarness';

function inPicker(props: { disabled?: boolean } = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <PickerHarness initial={{ h: 120, s: 0.5, v: 0.5 }} disabled={props.disabled}>
        {children}
      </PickerHarness>
    );
  };
}

describe('useColorPartState (the binding rule, D21)', () => {
  it('binds to an enclosing picker without value and defaultValue, and still reports to onValueChange', () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(
      () =>
        useColorPartState({
          value: undefined,
          defaultValue: undefined,
          onValueChange,
          disabled: false,
        }),
      { wrapper: inPicker() },
    );
    expect(result.current.picker).not.toBeNull();
    expect(result.current.color).toEqual({ h: 120, s: 0.5, v: 0.5 });
    act(() => result.current.setColor({ h: 120, s: 0.8, v: 0.5 }));
    expect(result.current.color).toEqual({ h: 120, s: 0.8, v: 0.5 });
    expect(onValueChange.mock.calls).toEqual([[{ h: 120, s: 0.8, v: 0.5 }]]);
  });

  it('stays independent with its own defaultValue inside a picker', () => {
    const { result } = renderHook(
      () =>
        useColorPartState({
          value: undefined,
          defaultValue: { h: 10, s: 1, v: 1 },
          onValueChange: undefined,
          disabled: false,
        }),
      { wrapper: inPicker() },
    );
    expect(result.current.picker).toBeNull();
    expect(result.current.color).toEqual({ h: 10, s: 1, v: 1 });
  });

  it('keeps its own state outside a picker, starting from the brand blue', () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(() =>
      useColorPartState({
        value: undefined,
        defaultValue: undefined,
        onValueChange,
        disabled: false,
      }),
    );
    expect(result.current.picker).toBeNull();
    expect(result.current.color).toBe(DEFAULT_PART_COLOR);
    act(() => result.current.setColor({ h: 0, s: 1, v: 1 }));
    expect(result.current.color).toEqual({ h: 0, s: 1, v: 1 });
    expect(onValueChange.mock.calls).toEqual([[{ h: 0, s: 1, v: 1 }]]);
  });

  it("takes the picker's disabled state while bound", () => {
    const { result } = renderHook(
      () =>
        useColorPartState({
          value: undefined,
          defaultValue: undefined,
          onValueChange: undefined,
          disabled: false,
        }),
      { wrapper: inPicker({ disabled: true }) },
    );
    expect(result.current.disabled).toBe(true);
  });

  it('reset restores defaultValue and reports only a real change (a new but equal object is none)', () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(() =>
      useColorPartState({
        value: undefined,
        defaultValue: { h: 10, s: 1, v: 1 },
        onValueChange,
        disabled: false,
      }),
    );
    act(() => result.current.reset());
    expect(onValueChange).not.toHaveBeenCalled();
    act(() => result.current.setColor({ h: 20, s: 1, v: 1 }));
    act(() => result.current.reset());
    expect(onValueChange.mock.calls).toEqual([[{ h: 20, s: 1, v: 1 }], [{ h: 10, s: 1, v: 1 }]]);
  });
});
