/**
 * The window events the shell's island dispatches, so later islands can listen without importing
 * it.
 */

/** Dispatched by the command bar's Search command; the command palette opens on it. */
export const SEARCH_EVENT = 'waveui:open-search';

/**
 * Dispatched after the reader picks a theme or a direction, once `<html>` carries it; `detail` is
 * the new `SiteChoice` (`{ theme, dir }`), for islands that render with a `WaveProvider`.
 */
export const CHOICE_EVENT = 'waveui:choice-change';
