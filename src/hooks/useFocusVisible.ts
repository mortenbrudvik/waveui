import { useSyncExternalStore } from 'react';

/** Keys that do not start keyboard navigation on their own. */
const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph']);

const POINTER_EVENTS = ['pointerdown', 'mousedown', 'touchstart'] as const;

let keyboardNavigation = false;
const listeners = new Set<() => void>();

function setKeyboardNavigation(next: boolean): void {
  if (next === keyboardNavigation) return;
  keyboardNavigation = next;
  listeners.forEach((listener) => listener());
}

function onKeyDown(event: KeyboardEvent): void {
  if (!MODIFIER_KEYS.has(event.key)) setKeyboardNavigation(true);
}

function onPointer(): void {
  setKeyboardNavigation(false);
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    document.addEventListener('keydown', onKeyDown, true);
    for (const type of POINTER_EVENTS) document.addEventListener(type, onPointer, true);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      document.removeEventListener('keydown', onKeyDown, true);
      for (const type of POINTER_EVENTS) document.removeEventListener(type, onPointer, true);
      // Without listeners the last input is unknown: the next subscriber starts from the pointer.
      keyboardNavigation = false;
    }
  };
}

function getSnapshot(): boolean {
  return keyboardNavigation;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Whether the page is in keyboard-navigation mode: `true` after the last input was a key press
 * (any key but a lone modifier), `false` after a pointer or touch press and before any input. For
 * logic that needs the mode in script, such as showing a focus cue in a widget that draws its own;
 * plain focus rings should keep using the `focus-visible` variant. One set of document listeners
 * serves every caller and goes away with the last one. `false` on the server and during
 * hydration.
 *
 * @example
 * const keyboard = useFocusVisible();
 * return <div data-keyboard={keyboard ? '' : undefined}>…</div>;
 */
export function useFocusVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
