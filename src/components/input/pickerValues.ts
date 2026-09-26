/** Shared value-array helpers for the multi-select listbox pickers. */

/** Whether two selections hold the same values in the same order (a reset compared by content). */
export function sameValues(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Toggles `value` in `values`, keeping selection order: appends it when absent, removes it when
 * present. `added` says which happened, for the caller's announcement.
 */
export function toggleValue(
  values: readonly string[],
  value: string,
): { values: string[]; added: boolean } {
  const added = !values.includes(value);
  return { values: added ? [...values, value] : values.filter((v) => v !== value), added };
}
