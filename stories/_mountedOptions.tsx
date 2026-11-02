/**
 * The readout of the windowed picker stories (Combobox, Dropdown and Listbox with
 * `virtualWindow`): how many options the list has rendered, out of how many items.
 */
import * as React from 'react';

/**
 * The `role="listbox"` list of `scope`: `scope` itself, or the list a combobox controls: `scope`
 * itself (the element a Combobox's or a Dropdown's `ref` reaches) or one inside it.
 */
function listOf(scope: HTMLElement): Element | null {
  const role = scope.getAttribute('role');
  if (role === 'listbox') return scope;
  const combobox = role === 'combobox' ? scope : scope.querySelector('[role="combobox"]');
  const id = combobox?.getAttribute('aria-controls');
  return id ? scope.ownerDocument.getElementById(id) : null;
}

/**
 * Counts the options rendered in the list of `scope` (a Listbox, or the combobox of a Combobox or
 * a Dropdown, whose open list renders in a portal), followed with a MutationObserver on the page.
 */
export function MountedOptions({ scope, total }: { scope: HTMLElement | null; total: number }) {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (!scope) return () => {};
      const observer = new MutationObserver(onChange);
      observer.observe(scope.ownerDocument.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    },
    [scope],
  );
  const mounted = React.useSyncExternalStore(
    subscribe,
    () => (scope ? (listOf(scope)?.querySelectorAll('[role="option"]').length ?? 0) : 0),
    () => 0,
  );
  return (
    <p className="text-body-1 text-foreground">
      Mounted options: {mounted} of {total.toLocaleString('en')}
    </p>
  );
}
