import { useCallback, useEffect, useInsertionEffect, useRef, useState } from 'react';
import { useEventCallback } from './useEventCallback';
import { warnOnce } from '../lib/dev';

/** Setter returned by {@link useControllable}: a direct value or a functional updater. */
export type SetValue<T> = (valueOrUpdater: T | ((prev: T) => T)) => void;

type Mode = 'controlled' | 'uncontrolled';

/**
 * Warns once per page and direction, through `src/lib/dev.ts` (C-DEV). `warnOnce(key, message)`
 * logs one prefixed string, so the directions are part of the message text (`from ${from} to
 * ${to}`) rather than separate console arguments.
 */
function warnModeSwitch(from: Mode, to: Mode): void {
  warnOnce(
    `useControllable:${from}->${to}`,
    `A component is changing from ${from} to ${to}. Components should not switch between ` +
      'controlled and uncontrolled: pass `undefined` only when the component is uncontrolled, and ' +
      'the empty value (for example `[]`, `null` or `""`) to clear a controlled value.',
  );
}

/**
 * State for components that can be controlled (`value` + `onChange` from the parent) or
 * uncontrolled (internal state seeded from `defaultValue`). Returns `[value, setValue]` like
 * `useState`, plus the current mode as a third element (`isControlled`) for components that treat
 * the two modes differently (e.g. store a clamp only while uncontrolled).
 *
 * - **Sticky controlled mode.** The component is controlled from the first render in which
 *   `controlledValue !== undefined` on. A value that arrives after mount (data loaded later) takes
 *   over immediately. A controlled value that later becomes `undefined` keeps the component
 *   controlled and returns the `defaultValue` argument — pass the component's empty value there
 *   (`defaultValueProp ?? []`), so `value={undefined}` clears it. Each direction warns once in
 *   development.
 * - **`setValue(valueOrUpdater)`** computes the next value from the value the user sees — the last
 *   rendered controlled value (plus a value already emitted earlier in the same event, so two
 *   functional updates in one handler chain) or the latest uncontrolled value — and calls
 *   `onChange` exactly once from the event path (never inside a state updater, so StrictMode does
 *   not double it). An update that does not change the value (`Object.is`) is skipped, including
 *   its `onChange`. A controlled parent that ignores `onChange` never leaves a stale value behind:
 *   the next event starts from the rendered value again.
 * - **What "the same event" means** (controlled mode). A value emitted by `setValue` stays pending
 *   until the next microtask checkpoint, and `setValue` calls made before then chain from it. Real
 *   user events are separate tasks, so each one starts from the rendered value. Everything
 *   dispatched synchronously within one task counts as one interaction and chains exactly like the
 *   uncontrolled mode does, whether the parent accepts the value or not: a nested `el.focus()` or
 *   `el.click()` from a handler, two `el.click()` calls from one timer callback, back-to-back
 *   `fireEvent` calls, or several `setValue` calls in one `act()`. Tests that need two separate
 *   interactions await a microtask between them (`await act(async () => {})`) or use `userEvent`.
 * - `setValue` has a stable identity; the latest `onChange` is always called. The rendered value
 *   and mode it reads are synced before any layout effect of a commit, so a layout or passive
 *   effect (also a child's, which React runs first) that calls `setValue` starts from the value
 *   committed in that same commit.
 *
 * Event-named callbacks that must fire on every activation (e.g. `onPageChange` on the current
 * page) are called by the component from its handler, not through this hook.
 *
 * @typeParam T - The type of the state value.
 * @param controlledValue - The controlled value, or `undefined` while the component is uncontrolled.
 * @param defaultValue - Initial uncontrolled value; also the value returned while a once-controlled
 *   value is `undefined`.
 * @param onChange - Called with the next value whenever `setValue` changes it (both modes).
 * @returns A `[value, setValue, isControlled]` tuple. `isControlled` is the sticky mode described
 *   above: `true` from the first render with a defined `controlledValue` on (also in that render
 *   itself and after the value becomes `undefined` again), `false` while the component has only
 *   ever been uncontrolled. Read the mode from here rather than tracking it in the component.
 */
export function useControllable<T>(
  controlledValue: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void,
): [value: T, setValue: SetValue<T>, isControlled: boolean] {
  const [initiallyControlled] = useState(controlledValue !== undefined);
  const [wasControlled, setWasControlled] = useState(initiallyControlled);
  if (controlledValue !== undefined && !wasControlled) {
    setWasControlled(true);
  }
  const isControlled = wasControlled || controlledValue !== undefined;

  const [internalValue, setInternalValue] = useState(defaultValue);
  const value: T = isControlled
    ? controlledValue !== undefined
      ? controlledValue
      : defaultValue
    : internalValue;

  // Value and mode of the last commit. Written only by the insertion effect below, never by setValue.
  const renderedRef = useRef(value);
  const isControlledRef = useRef(isControlled);
  // Uncontrolled: the latest value, updated optimistically by setValue (nobody can reject it).
  const latestRef = useRef(internalValue);
  // Controlled: the value emitted earlier in the same event; cleared in a microtask, never persisted
  // across events.
  const pendingRef = useRef<{ value: T } | null>(null);

  // An insertion effect runs in the commit's mutation phase, before every layout effect of that
  // commit, so a child's layout effect that calls setValue already sees the committed value and mode
  // (React runs a child's layout effects before its parent's). Not run on the server, where setValue
  // is never called.
  useInsertionEffect(() => {
    renderedRef.current = value;
    isControlledRef.current = isControlled;
    latestRef.current = internalValue;
  });

  useEffect(() => {
    if (controlledValue === undefined && wasControlled) {
      warnModeSwitch('controlled', 'uncontrolled');
    } else if (controlledValue !== undefined && !initiallyControlled) {
      warnModeSwitch('uncontrolled', 'controlled');
    }
  }, [controlledValue, wasControlled, initiallyControlled]);

  const emitChange = useEventCallback(onChange);

  const setValue = useCallback<SetValue<T>>(
    (valueOrUpdater) => {
      const controlled = isControlledRef.current;
      const base = controlled
        ? pendingRef.current
          ? pendingRef.current.value
          : renderedRef.current
        : latestRef.current;
      const next =
        typeof valueOrUpdater === 'function'
          ? (valueOrUpdater as (prev: T) => T)(base)
          : valueOrUpdater;
      if (Object.is(next, base)) return;

      if (controlled) {
        if (!pendingRef.current) {
          queueMicrotask(() => {
            pendingRef.current = null;
          });
        }
        pendingRef.current = { value: next };
      } else {
        latestRef.current = next;
        setInternalValue(next);
      }
      emitChange(next);
    },
    [emitChange],
  );

  return [value, setValue, isControlled];
}
