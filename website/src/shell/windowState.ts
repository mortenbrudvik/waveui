/**
 * Whether the window is maximized, remembered across pages. Without it, every link in the
 * navigation would restore a maximized window. `WINDOW_INIT_SCRIPT` runs as the window element's
 * first child, so the attribute is set before the window paints (no layout shift); the island's
 * Maximize/Restore button calls {@link saveMaximized}. Storage is used inside `try`.
 */

/** The storage key: `'1'` while maximized, `'0'` after a restore. */
export const MAXIMIZED_KEY = 'waveui-docs:maximized';

/** Sets `data-maximized` on the element that holds the script when the stored value is `'1'`. */
export const WINDOW_INIT_SCRIPT =
  'try{localStorage.getItem("waveui-docs:maximized")=="1"&&document.currentScript.parentElement.setAttribute("data-maximized","")}catch(e){}';

/** Remember the window state. A missing or failing storage is ignored. */
export function saveMaximized(maximized: boolean): void {
  try {
    window.localStorage.setItem(MAXIMIZED_KEY, maximized ? '1' : '0');
  } catch {
    // Storage may be blocked or full: the state then lasts for the page only.
  }
}
