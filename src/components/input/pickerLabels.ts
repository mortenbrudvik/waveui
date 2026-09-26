/** Built-in text shared by the listbox pickers; English defaults of their `labels`. */

/** Dropdown/Combobox `labels.selection`: the selected labels joined for display. */
export const defaultSelectionLabel = (labels: string[]): string => labels.join(', ');

/** Dropdown/Combobox/Listbox `labels.added`: announced when a multi-select toggle adds a value. */
export const defaultAddedLabel = (label: string, count: number): string =>
  `${label} added, ${count} selected`;

/** Dropdown/Combobox/Listbox `labels.removed`: announced when a multi-select toggle removes a value. */
export const defaultRemovedLabel = (label: string, count: number): string =>
  `${label} removed, ${count} selected`;
