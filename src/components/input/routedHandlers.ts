/**
 * The focus and key handlers a composite picker (Combobox, Dropdown, TagPicker, DatePicker,
 * TimePicker) routes to its focusable control instead of its root (C-ROUTING). Omitted from the
 * root's HTML attributes and declared again on the props with the control's element type.
 *
 * Internal: a key union for an `Omit` names no concept of its own, so it is not exported from the
 * package entry (listed in `src/__tests__/public-types.test.ts`).
 */
export type RoutedHandlers = 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp';
