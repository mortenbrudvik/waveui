/** Built-in text shared by the listbox pickers: English defaults of their `labels`, and the
 * announcements of their multi-select toggles. */
import { announce, useAnnounce } from '../../hooks/useAnnounce';

/** Dropdown/Combobox `labels.selection`: the selected labels joined for display. */
export const defaultSelectionLabel = (labels: string[]): string => labels.join(', ');

/** Dropdown/Combobox/Listbox `labels.added`: announced when a multi-select toggle adds a value. */
export const defaultAddedLabel = (label: string, count: number): string =>
  `${label} added, ${count} selected`;

/** Dropdown/Combobox/Listbox `labels.removed`: announced when a multi-select toggle removes a value. */
export const defaultRemovedLabel = (label: string, count: number): string =>
  `${label} removed, ${count} selected`;

/** The members of a picker's `labels` that word a toggle announcement. */
export interface ToggleAnnouncementLabels {
  added?: (label: string, count: number) => string;
  removed?: (label: string, count: number) => string;
}

/**
 * Announces a multi-select toggle the user made: `labels.added` or `labels.removed` (else their
 * English defaults) for the toggled option's `label`, with the `count` of values selected after it.
 * The picker's announcer regions ({@link PickerAnnouncer}) must be mounted.
 */
export function announceToggle(
  labels: ToggleAnnouncementLabels | undefined,
  label: string,
  added: boolean,
  count: number,
): void {
  const text = added
    ? (labels?.added ?? defaultAddedLabel)
    : (labels?.removed ?? defaultRemovedLabel);
  announce(text(label, count));
}

/**
 * Mounts the shared announcer regions (`useAnnounce`) while a multi-select picker is on the page,
 * so a single-select picker's DOM stays as in 0.7, with no `[data-wave-announcer]` added to
 * `document.body`. Renders nothing; {@link announceToggle} writes into the regions it keeps alive.
 */
export function PickerAnnouncer(): null {
  useAnnounce();
  return null;
}
PickerAnnouncer.displayName = 'PickerAnnouncer';
