import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for components that can be either controlled or uncontrolled.
 * If `controlledValue` is provided, the component is controlled; otherwise it uses internal state.
 * Warns in development if a component switches between controlled and uncontrolled modes.
 *
 * @typeParam T - The type of the state value.
 * @param controlledValue - The externally controlled value, or `undefined` for uncontrolled mode.
 * @param defaultValue - The initial value used when the component is uncontrolled.
 * @param onChange - Optional callback invoked when the value changes (in both modes).
 * @returns A `[value, setValue]` tuple matching the React useState signature.
 */
export function useControllable<T>(
  controlledValue: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void,
): [T, (value: T) => void] {
  const isControlledRef = useRef(controlledValue !== undefined);
  const isControlled = isControlledRef.current;
  const [internalValue, setInternalValue] = useState(defaultValue);

  // Warn in dev if switching between controlled and uncontrolled
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (typeof globalThis !== 'undefined' && (globalThis as any).__DEV__ === false) return;
    const wasControlled = isControlledRef.current;
    const isNowControlled = controlledValue !== undefined;
    if (wasControlled !== isNowControlled) {
      console.warn(
        'A component is changing from %s to %s. ' +
          'Components should not switch between controlled and uncontrolled.',
        wasControlled ? 'controlled' : 'uncontrolled',
        isNowControlled ? 'controlled' : 'uncontrolled',
      );
    }
  }, [controlledValue]);

  const value = isControlled ? (controlledValue as T) : internalValue;

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) {
        setInternalValue(next);
      }
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  return [value, setValue];
}
