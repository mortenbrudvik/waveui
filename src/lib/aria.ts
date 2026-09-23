/**
 * Joins id reference lists (`aria-describedby`, `aria-labelledby`, `aria-controls`, …): splits
 * each value on whitespace, drops empty values and duplicates, and keeps first-occurrence order.
 * Returns `undefined` when nothing is left, so React omits the attribute.
 *
 * @example joinIds(props['aria-describedby'], hintId, errorId)
 */
export function joinIds(...ids: Array<string | null | undefined | false>): string | undefined {
  const seen = new Set<string>();
  for (const value of ids) {
    if (!value) continue;
    for (const id of value.split(/\s+/)) {
      if (id) seen.add(id);
    }
  }
  return seen.size > 0 ? Array.from(seen).join(' ') : undefined;
}

/** Props that mark a control unavailable while keeping it focusable (C-DISABLED). */
export interface FocusableDisabledProps {
  'aria-disabled'?: true;
  'data-disabled'?: '';
}

/**
 * For controls that become unavailable as a result of their own activation (Pagination
 * First/Prev/Next/Last, Carousel Prev/Next, TeachingPopover Back): `aria-disabled="true"` plus
 * `data-disabled` instead of native `disabled`, so focus is not lost to `<body>`. Guard the
 * handlers with {@link preventIfDisabled}. Returns `{}` when enabled.
 */
export function focusableDisabledProps(disabled?: boolean): FocusableDisabledProps {
  return disabled ? { 'aria-disabled': true, 'data-disabled': '' } : {};
}

/**
 * Wraps an activation handler for a focusable-disabled control: while `disabled`, the event's
 * default action is prevented (an `aria-disabled` link does not navigate, a submit button does not
 * submit) and `handler` is not called.
 */
export function preventIfDisabled<E extends { preventDefault(): void }>(
  disabled: boolean | undefined,
  handler?: (event: E) => void,
): (event: E) => void {
  return (event: E) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    handler?.(event);
  };
}
