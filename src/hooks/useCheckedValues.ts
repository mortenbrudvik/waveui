import { useCallback, useMemo, useRef, useState } from 'react';
import { isDev, warnOnce } from '../lib/dev';
import type {
  CheckedValues,
  CheckedValuesChangeDetails,
  CheckedValuesChangeHandler,
} from '../lib/types';
import { useControllable } from './useControllable';

/** The checked-values state of a Menu tree or a Toolbar. */
export interface CheckedValuesApi {
  /** The rendered checked values (controlled, or the internal state). */
  readonly values: CheckedValues;
  /** Whether `value` is checked in group `name`. */
  isChecked(name: string, value: string): boolean;
  /**
   * Adds `value` to group `name` (at the end) or removes it: checkbox and switch items, toggles.
   * `listener` (a sharing submenu's `onCheckedValuesChange`) is called after the owner's callback
   * with the same arguments, only on change.
   */
  toggle(name: string, value: string, event: Event, listener?: CheckedValuesChangeHandler): void;
  /** Makes `value` the only checked value of group `name` (radio items); no change when it is. */
  select(name: string, value: string, event: Event, listener?: CheckedValuesChangeHandler): void;
}

/** The empty state: one frozen object, so an absent default keeps a stable identity. */
const EMPTY: CheckedValues = Object.freeze({});

/** The change being made: the group, the event behind it and the request's listener. */
interface ChangeRequest {
  name: string;
  event: Event;
  listener: CheckedValuesChangeHandler | undefined;
}

/**
 * The items of group `name`: an own property only, so a name that is an `Object.prototype` key
 * (`constructor`, `toString`, `__proto__`) reads as an empty group like any other unknown name.
 */
function groupOf(values: CheckedValues, name: string): readonly string[] {
  return (Object.hasOwn(values, name) ? values[name] : undefined) ?? [];
}

/** Sets group `name` as an own property (an assignment to `__proto__` would set the prototype). */
function setGroup(values: Record<string, string[]>, name: string, items: string[]): void {
  Object.defineProperty(values, name, {
    value: items,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

/** A copy of `values` in which every group is a new array, and group `name` holds `items`. */
function withGroup(
  values: CheckedValues,
  name: string,
  items: readonly string[],
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const key of Object.keys(values)) setGroup(next, key, [...groupOf(values, key)]);
  setGroup(next, name, [...items]);
  return next;
}

/** `second` after `first`, or `first` alone. */
function chainListeners(
  first: CheckedValuesChangeHandler,
  second: CheckedValuesChangeHandler | undefined,
): CheckedValuesChangeHandler {
  if (!second) return first;
  return (values, details) => {
    first(values, details);
    second(values, details);
  };
}

/**
 * The API a submenu that shares its parent's state passes to its items: `toggle` and `select`
 * forward to `api` with a listener that calls `listener` first, then any listener the caller
 * passed, so a nested chain calls the owner's callback, then the outer submenu's, then the inner
 * one's. Memoize the result on `api` and `listener`.
 */
export function withCheckedValuesListener(
  api: CheckedValuesApi,
  listener: CheckedValuesChangeHandler,
): CheckedValuesApi {
  return {
    values: api.values,
    isChecked: api.isChecked,
    toggle: (name, value, event, inner) =>
      api.toggle(name, value, event, chainListeners(listener, inner)),
    select: (name, value, event, inner) =>
      api.select(name, value, event, chainListeners(listener, inner)),
  };
}

/**
 * The checked-values state of a Menu tree or a Toolbar (`checkedValues`, `defaultCheckedValues`,
 * `onCheckedValuesChange`), through `useControllable`: controlled or uncontrolled, the callback
 * fires only on change, once per change (StrictMode included), and two changes made in one event
 * chain.
 *
 * - `toggle` and `select` compute the next value from the value the user sees. The next value is
 *   a new object in which every group is a new array; an unknown group reads as empty (a name
 *   that is an `Object.prototype` key, such as `constructor` or `__proto__`, included: groups are
 *   own properties), and removing a value keeps the order of the others. `select` of the value
 *   that already is the group's only value changes nothing and calls nothing.
 * - The callback receives a copy of the new values (every array copied again), so a consumer who
 *   mutates it, or stores it with `setState`, never changes the state the hook renders; `details`
 *   is `{ name, checkedItems, event }`, `checkedItems` being `checkedValues[name]` of that copy.
 *   A request's `listener` is then called with the same two arguments.
 * - The returned object is memoized on the rendered values (C-MEMO); `toggle` and `select` keep
 *   their identity.
 *
 * Internal (Menu, Toolbar).
 */
export function useCheckedValues(
  checkedValues: CheckedValues | undefined,
  defaultCheckedValues: CheckedValues | undefined,
  onCheckedValuesChange: CheckedValuesChangeHandler | undefined,
): CheckedValuesApi {
  // The request behind the change being made, set around the setter: useControllable calls its
  // onChange synchronously inside it, and only on change (the useModalOpenState pattern).
  const requestRef = useRef<ChangeRequest | undefined>(undefined);

  const [values, setValues] = useControllable<CheckedValues>(
    checkedValues,
    defaultCheckedValues ?? EMPTY,
    (next) => {
      const request = requestRef.current;
      if (!request) return;
      const emitted = withGroup(next, request.name, groupOf(next, request.name));
      const details: CheckedValuesChangeDetails = {
        name: request.name,
        checkedItems: emitted[request.name],
        event: request.event,
      };
      onCheckedValuesChange?.(emitted, details);
      request.listener?.(emitted, details);
    },
  );

  const change = useCallback(
    (request: ChangeRequest, update: (previous: CheckedValues) => CheckedValues) => {
      requestRef.current = request;
      try {
        setValues(update);
      } finally {
        requestRef.current = undefined;
      }
    },
    [setValues],
  );

  const toggle = useCallback<CheckedValuesApi['toggle']>(
    (name, value, event, listener) => {
      change({ name, event, listener }, (previous) => {
        const items = groupOf(previous, name);
        const next = items.includes(value)
          ? items.filter((item) => item !== value)
          : [...items, value];
        return withGroup(previous, name, next);
      });
    },
    [change],
  );

  const select = useCallback<CheckedValuesApi['select']>(
    (name, value, event, listener) => {
      change({ name, event, listener }, (previous) => {
        const items = groupOf(previous, name);
        if (items.length === 1 && items[0] === value) return previous;
        return withGroup(previous, name, [value]);
      });
    },
    [change],
  );

  return useMemo<CheckedValuesApi>(
    () => ({
      values,
      isChecked: (name, value) => groupOf(values, name).includes(value),
      toggle,
      select,
    }),
    [values, toggle, select],
  );
}

const noop = () => {};

/**
 * The duplicate check of one owner of checked values (a menu list, a toolbar): each item
 * registers its `name`/`value` pair from an effect and unregisters in the cleanup (the returned
 * function). Registering a pair that is already registered warns once under `warnKey` with
 * `message(name, value)`, since both items would show as checked.
 *
 * - The counts live as long as the caller, per owner: the same pair in two owners is fine, and
 *   StrictMode's effect, cleanup, effect counts an item once.
 * - The function keeps its identity while `warnKey` and `message` do, so pass a module-level
 *   `message` (the owner puts the function in a memoized context value, C-MEMO).
 * - Development only: in production registering counts nothing and returns a no-op.
 *
 * Internal (Menu, Toolbar).
 */
export function useDuplicatePairRegistry(
  warnKey: string,
  message: (name: string, value: string) => string,
): (name: string, value: string) => () => void {
  const [counts] = useState(() => new Map<string, number>());
  return useCallback(
    (name: string, value: string) => {
      if (!isDev) return noop;
      const key = JSON.stringify([name, value]);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      if (count > 1) warnOnce(warnKey, message(name, value));
      return () => {
        const remaining = (counts.get(key) ?? 1) - 1;
        if (remaining > 0) counts.set(key, remaining);
        else counts.delete(key);
      };
    },
    [counts, warnKey, message],
  );
}
