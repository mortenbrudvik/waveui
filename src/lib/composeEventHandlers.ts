/**
 * Composes a consumer's event handler with a component's internal one (C-COMPOSE).
 *
 * The consumer handler (`theirs`) runs first; the internal handler (`ours`) runs afterwards unless
 * the event's default was prevented — by the consumer, or already upstream — so consumers can opt
 * out of built-in behaviour with `event.preventDefault()`. Pass `{ checkDefaultPrevented: false }`
 * for internal work that must always run (bookkeeping, state that mirrors the DOM).
 *
 * @example
 * <button onClick={composeEventHandlers(onClick, () => onSelect(value))} />
 */
export function composeEventHandlers<E extends { defaultPrevented: boolean }>(
  theirs?: (event: E) => void,
  ours?: (event: E) => void,
  options?: { checkDefaultPrevented?: boolean },
): (event: E) => void {
  const checkDefaultPrevented = options?.checkDefaultPrevented !== false;
  return (event: E) => {
    theirs?.(event);
    if (!checkDefaultPrevented || !event.defaultPrevented) {
      ours?.(event);
    }
  };
}
