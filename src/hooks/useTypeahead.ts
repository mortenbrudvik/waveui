import { useCallback, useEffect, useRef } from 'react';
import type * as React from 'react';
import { useEventCallback } from './useEventCallback';

/** An item that typeahead can move to. */
export interface TypeaheadItem {
  value: string;
  /** Text matched against the typed characters (case-insensitive prefix match). */
  text: string;
  /** Disabled items are skipped. */
  disabled?: boolean;
}

/** Options of {@link useTypeahead}. */
export interface UseTypeaheadOptions {
  /** Returns the items in navigation order, read at key time. */
  getItems: () => TypeaheadItem[];
  /** Called with the value of the matched item. */
  onMatch: (value: string) => void;
  /** Milliseconds after the last key press before the typed prefix resets. @default 500 */
  timeout?: number;
}

/** Result of {@link useTypeahead}. */
export interface UseTypeaheadResult {
  /**
   * Handles a key press. Returns `true` when the key was a typeahead character that matched an
   * item (the caller should `preventDefault()`), `false` otherwise.
   *
   * @param event        The keydown event (DOM or React).
   * @param currentValue The value of the focused or active item, or `null`.
   */
  onTypeahead: (event: KeyboardEvent | React.KeyboardEvent, currentValue: string | null) => boolean;
}

function isTypeaheadKey(event: KeyboardEvent | React.KeyboardEvent, searching: boolean): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key.length !== 1) return false;
  // Space activates the focused item unless a search is in progress.
  return event.key !== ' ' || searching;
}

/**
 * Typeahead for lists, menus and trees (APG): printable characters typed within `timeout` build a
 * prefix; the next enabled item whose text starts with it (wrapping around from the current item)
 * is matched. Repeating one character cycles through the items that start with it.
 *
 * @example
 * const { onTypeahead } = useTypeahead({ getItems, onMatch: focusValue });
 * const onKeyDown = (e) => { if (onTypeahead(e, focusedValue)) e.preventDefault(); };
 */
export function useTypeahead(options: UseTypeaheadOptions): UseTypeaheadResult {
  const { timeout = 500 } = options;
  const getItems = useEventCallback(options.getItems);
  const onMatch = useEventCallback(options.onMatch);
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef(timeout);

  useEffect(() => {
    timeoutRef.current = timeout;
  }, [timeout]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    },
    [],
  );

  const onTypeahead = useCallback(
    (event: KeyboardEvent | React.KeyboardEvent, currentValue: string | null): boolean => {
      if (!isTypeaheadKey(event, bufferRef.current.length > 0)) return false;

      const search = bufferRef.current + event.key.toLowerCase();
      bufferRef.current = search;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        bufferRef.current = '';
        timerRef.current = null;
      }, timeoutRef.current);

      const items = getItems().filter((item) => !item.disabled);
      if (items.length === 0) return false;

      const repeated = search.length > 1 && Array.from(search).every((c) => c === search[0]);
      const prefix = repeated ? search[0] : search;
      const currentIndex = items.findIndex((item) => item.value === currentValue);
      const start = Math.max(currentIndex, 0);
      let candidates = [...items.slice(start), ...items.slice(0, start)];
      // A single character moves on from the current item; a longer prefix may keep it.
      if (prefix.length === 1 && currentIndex !== -1) {
        candidates = candidates.filter((item) => item.value !== currentValue);
      }
      const match = candidates.find((item) => item.text.trim().toLowerCase().startsWith(prefix));
      if (!match) return false;
      onMatch(match.value);
      return true;
    },
    [getItems, onMatch],
  );

  return { onTypeahead };
}
