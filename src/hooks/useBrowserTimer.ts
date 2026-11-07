import * as React from 'react';

/**
 * Manages one browser timer for `useTimeout` and `useAnimationFrame`: scheduling again replaces the
 * timer that is pending, the pair keeps its identity between renders and the pending timer is
 * cancelled when the component unmounts. Module-only.
 */
export function useBrowserTimer<C extends (...args: never[]) => void, A extends unknown[]>(
  setTimer: (callback: C, ...args: A) => number,
  cancelTimer: (id: number) => void,
): readonly [(callback: C, ...args: A) => number, () => void] {
  const id = React.useRef<number | undefined>(undefined);

  const set = React.useCallback(
    (callback: C, ...args: A) => {
      if (id.current !== undefined) cancelTimer(id.current);
      id.current = setTimer(callback, ...args);
      return id.current;
    },
    [setTimer, cancelTimer],
  );

  const cancel = React.useCallback(() => {
    if (id.current !== undefined) {
      cancelTimer(id.current);
      id.current = undefined;
    }
  }, [cancelTimer]);

  React.useEffect(() => cancel, [cancel]);

  return React.useMemo(() => [set, cancel] as const, [set, cancel]);
}
