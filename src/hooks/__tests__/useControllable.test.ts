import { describe, it, expect, vi, beforeEach, afterEach, expectTypeOf } from 'vitest';
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { useControllable, type SetValue } from '../useControllable';
import { __resetWarnings } from '../../lib/dev';

/** Lets the per-event pending value (cleared in a microtask) expire, as between two user events. */
async function nextEvent() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useControllable', () => {
  // Warnings are silenced, and a test that expects some takes them (takeWarnings): the afterEach
  // allows no other.
  let warnSpy: ReturnType<typeof vi.spyOn>;

  /** The warnings logged so far, removed from the spy (the test asserts them). */
  function takeWarnings(): unknown[] {
    const messages = warnSpy.mock.calls.map((call: unknown[]) => call[0]);
    warnSpy.mockClear();
    return messages;
  }

  const GUIDANCE =
    'Components should not switch between controlled and uncontrolled: pass `undefined` only when the component is uncontrolled, and the empty value (for example `[]`, `null` or `""`) to clear a controlled value.';
  // One string through src/lib/dev.ts warnOnce (C-DEV), directions in the right order.
  const TO_UNCONTROLLED = `[WaveUI] A component is changing from controlled to uncontrolled. ${GUIDANCE}`;
  const TO_CONTROLLED = `[WaveUI] A component is changing from uncontrolled to controlled. ${GUIDANCE}`;

  beforeEach(() => {
    __resetWarnings();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    try {
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      __resetWarnings();
    }
  });

  describe('basics', () => {
    it('uses defaultValue when uncontrolled', () => {
      const { result } = renderHook(() => useControllable(undefined, 'default'));
      expect(result.current[0]).toBe('default');
    });

    it('uses controlled value when provided', () => {
      const { result } = renderHook(() => useControllable('controlled', 'default'));
      expect(result.current[0]).toBe('controlled');
    });

    it('updates internal state in uncontrolled mode', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<string>(undefined, 'initial', onChange));

      act(() => {
        result.current[1]('updated');
      });

      expect(result.current[0]).toBe('updated');
      expect(onChange).toHaveBeenCalledWith('updated');
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('fires onChange in controlled mode but does not update internal state', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useControllable<string>('controlled', 'default', onChange),
      );

      act(() => {
        result.current[1]('new-value');
      });

      // Still shows controlled value
      expect(result.current[0]).toBe('controlled');
      expect(onChange).toHaveBeenCalledWith('new-value');
    });

    it('follows a new controlled value on rerender', () => {
      const { result, rerender } = renderHook(({ value }) => useControllable(value, 'default'), {
        initialProps: { value: 'a' as string | undefined },
      });
      rerender({ value: 'b' });
      expect(result.current[0]).toBe('b');
    });

    it('exports the SetValue type used by the setter', () => {
      const { result } = renderHook(() => useControllable<number>(undefined, 0));
      expectTypeOf(result.current[1]).toEqualTypeOf<SetValue<number>>();
    });
  });

  describe('isControlled flag (third tuple element)', () => {
    it('reports the sticky controlled mode', () => {
      const { result, rerender } = renderHook(
        ({ value }: { value: number | undefined }) => useControllable(value, 1),
        { initialProps: { value: undefined as number | undefined } },
      );
      expect(result.current[2]).toBe(false); // uncontrolled
      rerender({ value: 3 });
      expect(result.current[2]).toBe(true); // a late value takes over
      rerender({ value: undefined });
      expect(result.current[2]).toBe(true); // sticky: stays controlled
      expect(result.current[0]).toBe(1); // and reports the defaultValue argument
      // The mode switch warns (see the mode-switch warnings below).
      expect(takeWarnings()).toEqual([TO_CONTROLLED, TO_UNCONTROLLED]);
    });

    it('is true from the first render when mounted controlled', () => {
      const seen: boolean[] = [];
      renderHook(() => {
        const state = useControllable(5, 1);
        seen.push(state[2]);
        return state;
      });
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every(Boolean)).toBe(true);
    });

    it('is true in the very render in which a late value arrives', () => {
      const seen: Array<[number, boolean]> = [];
      const { rerender } = renderHook(
        ({ value }: { value: number | undefined }) => {
          const state = useControllable(value, 1);
          seen.push([state[0], state[2]]);
          return state;
        },
        { initialProps: { value: undefined as number | undefined } },
      );
      seen.length = 0;
      rerender({ value: 3 });
      // Every render that shows the controlled value also reports controlled mode.
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every(([value, controlled]) => value === 3 && controlled)).toBe(true);
      // The mode switch warns (see the mode-switch warnings below).
      expect(takeWarnings()).toEqual([TO_CONTROLLED]);
    });

    it('keeps the [value, setValue] destructuring working', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => {
        const [value, setValue] = useControllable<string>(undefined, 'a', onChange);
        return { value, setValue };
      });
      act(() => result.current.setValue('b'));
      expect(result.current.value).toBe('b');
      expect(onChange).toHaveBeenCalledWith('b');
    });

    it('types the flag as boolean', () => {
      const { result } = renderHook(() => useControllable<number>(undefined, 1));
      expectTypeOf(result.current).toEqualTypeOf<[number, SetValue<number>, boolean]>();
    });
  });

  describe('onChange is called once, from the event path (table-core#3, table-core#19)', () => {
    it('fires onChange exactly once per update under StrictMode (uncontrolled)', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<string>(undefined, 'a', onChange), {
        wrapper: React.StrictMode,
      });

      act(() => {
        result.current[1]('b');
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('b');
      expect(result.current[0]).toBe('b');
    });

    it('fires onChange exactly once per functional update under StrictMode', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<number>(undefined, 1, onChange), {
        wrapper: React.StrictMode,
      });

      act(() => {
        result.current[1]((prev) => prev + 1);
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(2);
      expect(result.current[0]).toBe(2);
    });

    it('never calls onChange during render when a parent sets state in it', () => {
      const errorSpy = vi.spyOn(console, 'error');
      try {
        const log: string[] = [];
        function useHarness() {
          const [parentLog, setParentLog] = React.useState<string[]>([]);
          const [value, setValue] = useControllable<string>(undefined, '', (next) => {
            log.push(next);
            setParentLog((prev) => [...prev, next]);
          });
          return { parentLog, value, setValue };
        }
        const { result } = renderHook(() => useHarness(), { wrapper: React.StrictMode });

        act(() => {
          result.current.setValue('x');
          result.current.setValue((prev) => prev + 'y');
        });

        expect(log).toEqual(['x', 'xy']);
        expect(result.current.parentLog).toEqual(['x', 'xy']);
        expect(result.current.value).toBe('xy');
        expect(errorSpy).not.toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('chains two batched functional updates in one handler (uncontrolled)', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<number>(undefined, 0, onChange));

      act(() => {
        result.current[1]((prev) => prev + 1);
        result.current[1]((prev) => prev + 1);
      });

      expect(result.current[0]).toBe(2);
      expect(onChange.mock.calls).toEqual([[1], [2]]);
    });

    it('chains two batched functional updates in one handler (controlled, parent accepts)', () => {
      const onChange = vi.fn();
      function useParent() {
        const [value, setParentValue] = React.useState(10);
        return useControllable<number>(value, 0, (next) => {
          onChange(next);
          setParentValue(next);
        });
      }
      const { result } = renderHook(() => useParent());

      act(() => {
        result.current[1]((prev) => prev + 1);
        result.current[1]((prev) => prev + 1);
      });

      expect(onChange.mock.calls).toEqual([[11], [12]]);
      expect(result.current[0]).toBe(12);
    });

    it('applies a controlled functional updater to the controlled value, not the default', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<number>(10, 0, onChange));

      act(() => {
        result.current[1]((prev) => prev + 1);
      });

      expect(onChange).toHaveBeenCalledWith(11);
    });

    it('applies a controlled toggle to the controlled value (pressed=true -> false)', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<boolean>(true, false, onChange));

      act(() => {
        result.current[1]((prev) => !prev);
      });

      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe('controlled parent that ignores onChange (no stale value)', () => {
    it('setValue(false) in three separate events calls onChange three times', async () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<boolean>(true, false, onChange));

      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current[1](false);
        });
        await nextEvent();
      }

      expect(onChange.mock.calls).toEqual([[false], [false], [false]]);
      expect(result.current[0]).toBe(true);
    });

    it('suppresses the same value set twice within one event', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<boolean>(true, false, onChange));

      act(() => {
        result.current[1](false);
        result.current[1](false);
      });

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('a functional toggle in two separate events emits (true), (true)', async () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<boolean>(false, false, onChange));

      act(() => {
        result.current[1]((prev) => !prev);
      });
      await nextEvent();
      act(() => {
        result.current[1]((prev) => !prev);
      });

      expect(onChange.mock.calls).toEqual([[true], [true]]);
      expect(result.current[0]).toBe(false);
    });

    it('chains a functional toggle twice within one event', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<boolean>(false, false, onChange));

      act(() => {
        result.current[1]((prev) => !prev);
        result.current[1]((prev) => !prev);
      });

      expect(onChange.mock.calls).toEqual([[true], [false]]);
    });

    it('retrying a rejected value fires onChange again', async () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<string>('a', '', onChange));

      act(() => {
        result.current[1]('b');
      });
      await nextEvent();
      act(() => {
        result.current[1]('b');
      });

      expect(onChange.mock.calls).toEqual([['b'], ['b']]);
    });

    it('two user clicks emit (true), (true) while the rendered value stays false', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      function Toggle() {
        const [pressed, setPressed] = useControllable<boolean>(false, false, onChange);
        return React.createElement(
          'button',
          { type: 'button', 'aria-pressed': pressed, onClick: () => setPressed((p) => !p) },
          'Toggle',
        );
      }
      render(React.createElement(Toggle));
      const button = screen.getByRole('button', { name: 'Toggle' });

      await user.click(button);
      await user.click(button);

      expect(onChange.mock.calls).toEqual([[true], [true]]);
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('two fireEvent clicks with a microtask between them emit (true), (true)', async () => {
      const onChange = vi.fn();
      function Toggle() {
        const [pressed, setPressed] = useControllable<boolean>(false, false, onChange);
        return React.createElement(
          'button',
          { type: 'button', 'aria-pressed': pressed, onClick: () => setPressed((p) => !p) },
          'Toggle',
        );
      }
      render(React.createElement(Toggle));
      const button = screen.getByRole('button', { name: 'Toggle' });

      fireEvent.click(button);
      await nextEvent();
      fireEvent.click(button);

      expect(onChange.mock.calls).toEqual([[true], [true]]);
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('still chains within one event while a nested event is dispatched from its handler', () => {
      const onChange = vi.fn();
      function Toggle() {
        const [pressed, setPressed] = useControllable<boolean>(false, false, onChange);
        const otherRef = React.useRef<HTMLButtonElement>(null);
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'button',
            {
              type: 'button',
              'aria-pressed': pressed,
              onClick: () => {
                setPressed((p) => !p);
                otherRef.current?.click();
              },
            },
            'Toggle',
          ),
          React.createElement(
            'button',
            { type: 'button', ref: otherRef, onClick: () => setPressed((p) => !p) },
            'Other',
          ),
        );
      }
      render(React.createElement(Toggle));

      fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

      // The nested click runs while the outer click is still being dispatched: same interaction.
      expect(onChange.mock.calls).toEqual([[true], [false]]);
    });

    it('a parent that accepts the value makes the next event start from it', async () => {
      const onChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ value }) => useControllable<number>(value, 0, onChange),
        { initialProps: { value: 1 } },
      );

      act(() => {
        result.current[1]((prev) => prev + 1);
      });
      rerender({ value: 2 });
      await nextEvent();
      act(() => {
        result.current[1]((prev) => prev + 1);
      });

      expect(onChange.mock.calls).toEqual([[2], [3]]);
    });
  });

  describe('child layout effects in the commit that changed the value (table-core#3)', () => {
    interface ProbeProps {
      value: number;
      setValue: SetValue<number>;
      probe: (value: number, setValue: SetValue<number>) => void;
    }

    /** Calls `probe` from a layout effect, which React runs before its parent's layout effects. */
    function LayoutProbe({ value, setValue, probe }: ProbeProps) {
      React.useLayoutEffect(() => {
        probe(value, setValue);
      }, [value, setValue, probe]);
      return null;
    }

    function Owner({
      value,
      onChange,
      probe,
    }: {
      value: number | undefined;
      onChange: (next: number) => void;
      probe: ProbeProps['probe'];
    }) {
      const [current, setValue] = useControllable<number>(value, 0, onChange);
      return React.createElement(LayoutProbe, { value: current, setValue, probe });
    }

    it('a functional updater receives the controlled value committed in the same commit', () => {
      const seen: number[] = [];
      const onChange = vi.fn();
      const probe = (_value: number, setValue: SetValue<number>) => {
        setValue((prev) => {
          seen.push(prev);
          return prev;
        });
      };
      const { rerender } = render(React.createElement(Owner, { value: 1, onChange, probe }));

      rerender(React.createElement(Owner, { value: 2, onChange, probe }));

      expect(seen).toEqual([1, 2]);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('setting the value that was just committed is a no-op', () => {
      const onChange = vi.fn();
      const probe = (value: number, setValue: SetValue<number>) => setValue(value);
      const { rerender } = render(React.createElement(Owner, { value: 1, onChange, probe }));

      rerender(React.createElement(Owner, { value: 2, onChange, probe }));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('sees the controlled mode of a value that arrived in the same commit', () => {
      const onChange = vi.fn();
      const probe = (value: number, setValue: SetValue<number>) => {
        if (value === 5) setValue((prev) => prev + 1);
      };
      const { rerender } = render(
        React.createElement(Owner, { value: undefined, onChange, probe }),
      );

      rerender(React.createElement(Owner, { value: 5, onChange, probe }));

      // Controlled from this commit on: the updater starts from 5, not from the internal 0.
      expect(onChange.mock.calls).toEqual([[6]]);
      // The mode switch warns (see the mode-switch warnings below).
      expect(takeWarnings()).toEqual([TO_CONTROLLED]);
    });
  });

  describe('events dispatched within one task chain in every mode (table-core#3)', () => {
    interface ToggleProps {
      value: boolean | undefined;
      onValueChange: (next: boolean) => void;
    }

    /** Focusing the field opens; the button focuses the field (a nested focus event), then toggles. */
    function FocusThenToggle({ value, onValueChange }: ToggleProps) {
      const [open, setOpen] = useControllable<boolean>(value, false, onValueChange);
      const fieldRef = React.useRef<HTMLInputElement>(null);
      return React.createElement(
        React.Fragment,
        null,
        React.createElement('input', {
          'aria-label': 'Field',
          ref: fieldRef,
          onFocus: () => setOpen(true),
        }),
        React.createElement(
          'button',
          {
            type: 'button',
            'aria-expanded': open,
            onClick: () => {
              fieldRef.current?.focus();
              setOpen((o) => !o);
            },
          },
          'Focus and toggle',
        ),
      );
    }

    /** "Toggle twice" clicks "Toggle" twice from its own handler (two nested click events). */
    function DoubleToggle({ value, onValueChange }: ToggleProps) {
      const [pressed, setPressed] = useControllable<boolean>(value, false, onValueChange);
      const toggleRef = React.useRef<HTMLButtonElement>(null);
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'button',
          {
            type: 'button',
            ref: toggleRef,
            'aria-pressed': pressed,
            onClick: () => setPressed((p) => !p),
          },
          'Toggle',
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () => {
              toggleRef.current?.click();
              toggleRef.current?.click();
            },
          },
          'Toggle twice',
        ),
      );
    }

    type HarnessMode = 'uncontrolled' | 'controlled, parent accepts' | 'controlled, parent ignores';
    const modes: HarnessMode[] = [
      'uncontrolled',
      'controlled, parent accepts',
      'controlled, parent ignores',
    ];

    function renderIn(mode: HarnessMode, Component: React.ComponentType<ToggleProps>) {
      const onValueChange = vi.fn<(next: boolean) => void>();
      function Parent() {
        const [value, setValue] = React.useState(false);
        return React.createElement(Component, {
          value: mode === 'uncontrolled' ? undefined : value,
          onValueChange: (next: boolean) => {
            onValueChange(next);
            if (mode === 'controlled, parent accepts') setValue(next);
          },
        });
      }
      render(React.createElement(Parent));
      return onValueChange;
    }

    it.each(modes)('a nested focus event, then a toggle in the same handler (%s)', (mode) => {
      const onValueChange = renderIn(mode, FocusThenToggle);
      const button = screen.getByRole('button', { name: 'Focus and toggle' });

      fireEvent.click(button);

      // Same sequence as the uncontrolled component: open, then toggled closed again.
      expect(onValueChange.mock.calls).toEqual([[true], [false]]);
      expect(screen.getByRole('textbox', { name: 'Field' })).toHaveFocus();
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it.each(modes)('two nested clicks dispatched from one handler (%s)', (mode) => {
      const onValueChange = renderIn(mode, DoubleToggle);

      fireEvent.click(screen.getByRole('button', { name: 'Toggle twice' }));

      expect(onValueChange.mock.calls).toEqual([[true], [false]]);
      expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it.each(modes)('two programmatic clicks from one timer callback (%s)', async (mode) => {
      const onValueChange = renderIn(mode, DoubleToggle);
      const toggle = screen.getByRole('button', { name: 'Toggle' });

      await act(async () => {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            toggle.click();
            toggle.click();
            resolve();
          }, 0);
        });
      });

      expect(onValueChange.mock.calls).toEqual([[true], [false]]);
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('no-op suppression (layout#20)', () => {
    it('does not call onChange when the value does not change (uncontrolled)', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<number>(undefined, 1, onChange));

      act(() => {
        result.current[1](1);
        result.current[1]((prev) => prev);
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not call onChange when the value equals the controlled value', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<number>(5, 0, onChange));

      act(() => {
        result.current[1](5);
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('uses Object.is (NaN is equal to NaN, -0 differs from +0)', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useControllable<number>(undefined, Number.NaN, onChange));

      act(() => {
        result.current[1](Number.NaN);
      });
      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        result.current[1](-0);
      });
      act(() => {
        result.current[1](0);
      });
      expect(onChange.mock.calls).toEqual([[-0], [0]]);
    });
  });

  describe('stable setter identity (table-core#23)', () => {
    it('keeps setValue identity across rerenders with an inline onChange and value changes', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useControllable<number>(value, 0, (next) => void next),
        { initialProps: { value: undefined as number | undefined } },
      );
      const first = result.current[1];

      act(() => {
        result.current[1](1);
      });
      rerender({ value: undefined });
      expect(result.current[1]).toBe(first);
    });

    it('calls the latest onChange after a rerender', () => {
      const first = vi.fn();
      const second = vi.fn();
      const { result, rerender } = renderHook(
        ({ onChange }) => useControllable<number>(undefined, 0, onChange),
        { initialProps: { onChange: first } },
      );

      rerender({ onChange: second });
      act(() => {
        result.current[1](1);
      });

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledWith(1);
    });
  });

  describe('sticky controlled mode (table-core#4)', () => {
    it('adopts a controlled value that arrives after mount', () => {
      const onChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ value }) => useControllable<string[]>(value, [], onChange),
        { initialProps: { value: undefined as string[] | undefined } },
      );
      expect(result.current[0]).toEqual([]);

      const loaded = ['a', 'b'];
      rerender({ value: loaded });
      expect(result.current[0]).toBe(loaded);

      act(() => {
        result.current[1]((prev) => [...prev, 'c']);
      });
      expect(onChange).toHaveBeenCalledWith(['a', 'b', 'c']);
      // The mode switch warns (see the mode-switch warnings below).
      expect(takeWarnings()).toEqual([TO_CONTROLLED]);
    });

    it('returns the defaultValue argument when a controlled value becomes undefined', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useControllable<string[]>(value, [], vi.fn()),
        { initialProps: { value: ['a'] as string[] | undefined } },
      );
      expect(result.current[0]).toEqual(['a']);

      rerender({ value: undefined });
      expect(result.current[0]).toEqual([]);
      expect(result.current[0]).not.toBeUndefined();
      // The mode switch warns (see the mode-switch warnings below).
      expect(takeWarnings()).toEqual([TO_UNCONTROLLED]);
    });

    it('returns the current defaultValue argument (the empty value), never the stale value', () => {
      const { result, rerender } = renderHook(
        ({ value, empty }) => useControllable<string | null>(value, empty),
        { initialProps: { value: 'x' as string | null | undefined, empty: null as string | null } },
      );
      rerender({ value: undefined, empty: null });
      expect(result.current[0]).toBeNull();
      // The mode switch warns (see the mode-switch warnings below).
      expect(takeWarnings()).toEqual([TO_UNCONTROLLED]);
    });

    it('stays controlled after the value becomes undefined: setValue calls onChange without internal state', () => {
      const onChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ value }) => useControllable<string>(value, '', onChange),
        { initialProps: { value: 'a' as string | undefined } },
      );
      rerender({ value: undefined });

      act(() => {
        result.current[1]('b');
      });

      expect(onChange).toHaveBeenCalledWith('b');
      expect(result.current[0]).toBe('');
      // The mode switch warns (see the mode-switch warnings below).
      expect(takeWarnings()).toEqual([TO_UNCONTROLLED]);
    });
  });

  describe('mode-switch warnings (table-core#28)', () => {
    it('warns "from controlled to uncontrolled" when switching from controlled to uncontrolled', () => {
      const { rerender } = renderHook(({ value }) => useControllable(value, 'default'), {
        initialProps: { value: 'controlled' as string | undefined },
      });
      expect(warnSpy).not.toHaveBeenCalled();

      rerender({ value: undefined });

      expect(takeWarnings()).toEqual([TO_UNCONTROLLED]);
    });

    it('warns "from uncontrolled to controlled" when switching from uncontrolled to controlled', () => {
      const { rerender } = renderHook(({ value }) => useControllable(value, 'default'), {
        initialProps: { value: undefined as string | undefined },
      });
      expect(warnSpy).not.toHaveBeenCalled();

      rerender({ value: 'controlled' });

      expect(takeWarnings()).toEqual([TO_CONTROLLED]);
    });

    it('warns once, on the first switch: the mode stays fixed, so later switches add no warning', () => {
      const { rerender } = renderHook(({ value }) => useControllable(value, 'default'), {
        initialProps: { value: 'a' as string | undefined },
      });
      rerender({ value: undefined });
      rerender({ value: 'b' });
      rerender({ value: undefined });
      rerender({ value: 'c' });

      // The controlled mode is sticky: only the first switch warns, once.
      expect(takeWarnings()).toEqual([TO_UNCONTROLLED]);
    });

    it('does not warn in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      try {
        const { rerender } = renderHook(({ value }) => useControllable(value, 'default'), {
          initialProps: { value: 'a' as string | undefined },
        });
        rerender({ value: undefined });
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('does not warn for a component that stays controlled or uncontrolled', () => {
      const { rerender } = renderHook(({ value }) => useControllable(value, 'default'), {
        initialProps: { value: 'a' as string | undefined },
      });
      rerender({ value: 'b' });
      const { rerender: rerender2 } = renderHook(({ value }) => useControllable(value, 'default'), {
        initialProps: { value: undefined as string | undefined },
      });
      rerender2({ value: undefined });
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
