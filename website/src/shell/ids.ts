/**
 * The ids of the shell's elements that the server markup and the island share: the island finds
 * the window, the navigation and the maximize button's place by them.
 */
export const SHELL_IDS = {
  /** The app window, which carries `data-maximized` and, while the drawer is open, `data-nav-open`. */
  window: 'shell-window',
  /** The navigation pane (`<nav aria-label="Components">`), the hamburger's `aria-controls`. */
  nav: 'components-nav',
  /** The content (`<main>`), the skip link's target. */
  main: 'main',
  /** The place in the title bar's controls where the island renders Maximize/Restore. */
  maximizeSlot: 'shell-maximize-slot',
} as const;
