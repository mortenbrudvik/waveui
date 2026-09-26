/** Shared value-array helpers for the multi-select listbox pickers. */

/** The empty multi-select value: a stable array (the default without `defaultValue`, the cleared
 * value). */
export const EMPTY_VALUES: readonly string[] = [];

/**
 * The selected values of a picker's value: an array as it is, a non-empty string as its one value,
 * and anything else (`''`, or `null` and `undefined` passed from JavaScript past the types) as none.
 */
export function toValues(value: string | readonly string[] | null | undefined): readonly string[] {
  if (Array.isArray(value)) return value;
  return typeof value === 'string' && value !== '' ? [value] : EMPTY_VALUES;
}

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

/**
 * The value a multi-select form reset restores (C-FORMS): `current` itself when it already holds
 * the values of `defaultValue` in the same order, so an unchanged reset reports nothing (an inline
 * default array is a new reference on every render), else a copy of them. A default that is not an
 * array (from JavaScript) restores no values.
 */
export function resetValues(
  current: string | readonly string[],
  defaultValue: string | readonly string[] | undefined,
): string | readonly string[] {
  const initial = Array.isArray(defaultValue) ? defaultValue : EMPTY_VALUES;
  const currentValues = Array.isArray(current) ? current : EMPTY_VALUES;
  return sameValues(currentValues, initial) ? current : [...initial];
}
