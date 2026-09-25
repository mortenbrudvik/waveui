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
  /**
   * Called with the value of the matched item, and with every item that matches the typed
   * characters in search order (`value` first), for a caller that passes over an item it cannot
   * move to.
   */
  onMatch: (value: string, matches: readonly string[]) => void;
  /** Milliseconds after the last key press before the typed prefix resets. @default 500 */
  timeout?: number;
}

/** Result of {@link useTypeahead}. */
export interface UseTypeaheadResult {
  /**
   * Handles a key press. Returns `true` when the key was consumed as typeahead: it matched an
   * item, or it continued a search (see `isSearching`), even when nothing matches, a Space
   * included. The caller should `preventDefault()`. Returns `false` for a key that is not
   * typeahead, and for the first character of a search when it matches nothing (so a closed
   * listbox can still open on it); that character still starts the search.
   *
   * @param event        The keydown event (DOM or React).
   * @param currentValue The value of the focused or active item, or `null`.
   */
  onTypeahead: (event: KeyboardEvent | React.KeyboardEvent, currentValue: string | null) => boolean;
  /**
   * Whether a search is in progress: a printable key was typed less than `timeout` ms ago,
   * whether or not it matched. A Space typed now continues the search.
   */
  isSearching: () => boolean;
}

/**
 * A character typed with AltGr, which Windows reports as Ctrl+Alt (Polish `ł`, Romanian `ș`): text
 * input for typeahead, not a shortcut. Ctrl+Alt with a named key (Ctrl+Alt+ArrowDown) or with
 * Space (AltGr types no plain space) is a shortcut. Internal (not exported from the package entry).
 */
export function isAltGraphCharacter(event: KeyboardEvent | React.KeyboardEvent): boolean {
  return event.ctrlKey && event.altKey && event.key.length === 1 && event.key !== ' ';
}

function isTypeaheadKey(event: KeyboardEvent | React.KeyboardEvent, searching: boolean): boolean {
  if (event.key.length !== 1 || event.metaKey) return false;
  // Ctrl or Alt is a shortcut, except a character typed with AltGr.
  if ((event.ctrlKey || event.altKey) && !isAltGraphCharacter(event)) return false;
  // Space activates the focused item unless a search is in progress.
  return event.key !== ' ' || searching;
}

/**
 * Typeahead for lists, menus and trees (APG): printable characters typed within `timeout` build a
 * prefix; the next enabled item whose text starts with it (wrapping around from the current item)
 * is matched. Repeating one character cycles through the items that start with it. Characters
 * typed with AltGr (Ctrl+Alt on Windows) count; Ctrl, Alt or Meta shortcuts do not.
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
      const searching = bufferRef.current.length > 0;
      if (!isTypeaheadKey(event, searching)) return false;

      const search = bufferRef.current + event.key.toLowerCase();
      bufferRef.current = search;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        bufferRef.current = '';
        timerRef.current = null;
      }, timeoutRef.current);

      const items = getItems().filter((item) => !item.disabled);
      // A search already in progress consumed this key even when nothing matches, so the caller
      // must not activate or commit. The first unmatched character still returns false.
      if (items.length === 0) return searching;

      const repeated = search.length > 1 && Array.from(search).every((c) => c === search[0]);
      const prefix = repeated ? search[0] : search;
      const currentIndex = items.findIndex((item) => item.value === currentValue);
      const start = Math.max(currentIndex, 0);
      let candidates = [...items.slice(start), ...items.slice(0, start)];
      // A single character moves on from the current item; a longer prefix may keep it.
      if (prefix.length === 1 && currentIndex !== -1) {
        candidates = candidates.filter((item) => item.value !== currentValue);
      }
      const matches = candidates
        .filter((item) => item.text.trim().toLowerCase().startsWith(prefix))
        .map((item) => item.value);
      if (matches.length === 0) return searching;
      onMatch(matches[0], matches);
      return true;
    },
    [getItems, onMatch],
  );

  const isSearching = useCallback(() => bufferRef.current.length > 0, []);

  return { onTypeahead, isSearching };
}
