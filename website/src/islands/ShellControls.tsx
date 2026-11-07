/**
 * The shell's one island (`client:idle`): everything of the window that needs script. It renders
 * the command bar (`shell/CommandBar.tsx`) and, once hydrated, the title bar's Maximize/Restore
 * button through a portal into its reserved place, and owns:
 *
 * - maximize/restore: `data-maximized` on the window, remembered (`shell/windowState.ts`);
 * - the theme and direction: `<html>`'s `wave-*` class and `dir`, saved with `saveChoice`, then a
 *   `CHOICE_EVENT` for other islands;
 * - the navigation drawer below 48rem: the hamburger sets `data-nav-open` on the window (site.css
 *   shows the pane as a drawer), focus moves to the current link, and Escape, a click on the
 *   backdrop or focus moving elsewhere closes it;
 * - Copy code, which copies `copyText`, with a polite announcement;
 * - Search, which dispatches `SEARCH_EVENT`;
 * - the search palette: Ctrl+K or Cmd+K anywhere in the page (a text field included; the key is
 *   taken from the browser only when it opens the palette), and `SEARCH_EVENT`, open it. Its
 *   module (`SearchPalette.tsx`) is imported on that first opening, through
 *   {@link searchPaletteChunk}, never before, and stays mounted for the next; focus returns to
 *   the element that had it when the palette was asked for.
 *
 * Its first render equals the server's (light, left to right, controls disabled), so hydration
 * matches; an effect then reads what the inline scripts applied before paint.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import { CommandBar, type CopyStatus } from '../shell/CommandBar';
import { CHOICE_EVENT, SEARCH_EVENT } from '../shell/events';
import { SHELL_IDS } from '../shell/ids';
import { MaximizeButton } from '../shell/TitleBar';
import { saveMaximized } from '../shell/windowState';
import {
  readDocumentChoice,
  saveChoice,
  type SiteChoice,
  type SiteTheme,
} from '../theme/themeChoice';
import type { SearchPaletteProps } from './SearchPalette';

export interface ShellControlsProps {
  /** The text Copy code copies (the page's first story's source); without it, no Copy code. */
  copyText?: string | undefined;
}

/**
 * Loads the search palette's chunk. An object, so a test can spy on the dynamic import; the island
 * calls it on the first request to open the palette.
 */
export const searchPaletteChunk = {
  load: (): Promise<{ default: React.ComponentType<SearchPaletteProps> }> =>
    import('./SearchPalette'),
};

/** Ctrl+K or Cmd+K, without Shift or Alt (Ctrl+Alt is AltGr on Windows). */
const isSearchShortcut = (event: KeyboardEvent) =>
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  !event.shiftKey &&
  !event.isComposing &&
  event.key.toLowerCase() === 'k';

const THEMES: readonly SiteTheme[] = ['light', 'dark', 'high-contrast'];
const COPY_STATUS_MS = 3000;

const byId = (id: string) => document.getElementById(id);

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function applyChoice(choice: SiteChoice): void {
  const html = document.documentElement;
  html.classList.remove(...THEMES.map((theme) => `wave-${theme}`));
  html.classList.add(`wave-${choice.theme}`);
  html.dir = choice.dir;
  saveChoice(storage(), choice);
  window.dispatchEvent(new CustomEvent(CHOICE_EVENT, { detail: choice }));
}

export default function ShellControls({ copyText }: ShellControlsProps) {
  const [ready, setReady] = React.useState(false);
  const [choice, setChoice] = React.useState<SiteChoice>({ theme: 'light', dir: 'ltr' });
  const [maximized, setMaximized] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false);
  const [copyStatus, setCopyStatus] = React.useState<CopyStatus>('idle');
  const [maximizeSlot, setMaximizeSlot] = React.useState<HTMLElement | null>(null);
  const hamburgerRef = React.useRef<HTMLButtonElement>(null);
  const [Palette, setPalette] = React.useState<React.ComponentType<SearchPaletteProps> | null>(
    null,
  );
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchOpenRef = React.useRef(false);
  const paletteRequested = React.useRef(false);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);

  /** Opens the palette, loading it the first time; false when it is already open. */
  const openSearch = React.useCallback((): boolean => {
    if (searchOpenRef.current) return false;
    const focused = document.activeElement;
    returnFocusRef.current =
      focused instanceof HTMLElement && focused !== document.body ? focused : null;
    searchOpenRef.current = true;
    setSearchOpen(true);
    if (!paletteRequested.current) {
      paletteRequested.current = true;
      searchPaletteChunk.load().then(
        (chunk) => setPalette(() => chunk.default),
        () => {
          // A failed chunk (offline) is tried again on the next request.
          paletteRequested.current = false;
          searchOpenRef.current = false;
          setSearchOpen(false);
        },
      );
    }
    return true;
  }, []);

  const closeSearch = React.useCallback(() => {
    searchOpenRef.current = false;
    setSearchOpen(false);
  }, []);

  // The shortcut is read in the capture phase, so no widget of the page that stops the key's
  // propagation keeps it from the palette.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSearchShortcut(event) && openSearch()) event.preventDefault();
    };
    const onSearch = () => {
      openSearch();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener(SEARCH_EVENT, onSearch);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener(SEARCH_EVENT, onSearch);
    };
  }, [openSearch]);

  React.useEffect(() => {
    setChoice(readDocumentChoice());
    setMaximized(byId(SHELL_IDS.window)?.hasAttribute('data-maximized') ?? false);
    setMaximizeSlot(byId(SHELL_IDS.maximizeSlot));
    setReady(true);
  }, []);

  const closeNav = React.useCallback((returnFocus: boolean) => {
    byId(SHELL_IDS.window)?.removeAttribute('data-nav-open');
    setNavOpen(false);
    if (returnFocus) hamburgerRef.current?.focus();
  }, []);

  const toggleNav = () => {
    if (navOpen) {
      closeNav(false);
      return;
    }
    byId(SHELL_IDS.window)?.setAttribute('data-nav-open', '');
    setNavOpen(true);
    // The current page's link, else the first link (a selector list would take whichever comes
    // first in the document: the Guides group's).
    const nav = byId(SHELL_IDS.nav);
    (
      nav?.querySelector<HTMLElement>('[aria-current="page"]') ??
      nav?.querySelector<HTMLElement>('a[href]')
    )?.focus();
  };

  // While the drawer is open: Escape closes it (focus back to the hamburger), and so does focus
  // moving to anything outside it but the hamburger, whose own click toggles it.
  React.useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) closeNav(true);
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null;
      if (!target || byId(SHELL_IDS.nav)?.contains(target)) return;
      if (target === hamburgerRef.current) return;
      closeNav(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [navOpen, closeNav]);

  React.useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = setTimeout(() => setCopyStatus('idle'), COPY_STATUS_MS);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  const toggleMaximized = () => {
    const next = !maximized;
    byId(SHELL_IDS.window)?.toggleAttribute('data-maximized', next);
    saveMaximized(next);
    setMaximized(next);
  };

  const copy = () => {
    if (!copyText) return;
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    const written = clipboard
      ? clipboard.writeText(copyText)
      : Promise.reject(new Error('no clipboard'));
    written.then(
      () => setCopyStatus('copied'),
      () => setCopyStatus('failed'),
    );
  };

  const choose = (next: SiteChoice) => {
    applyChoice(next);
    setChoice(next);
  };

  return (
    <>
      <CommandBar
        ready={ready}
        copyText={copyText}
        choice={choice}
        navOpen={navOpen}
        copyStatus={copyStatus}
        hamburgerRef={hamburgerRef}
        onToggleNav={toggleNav}
        onCopy={copy}
        onSearch={() => window.dispatchEvent(new CustomEvent(SEARCH_EVENT))}
        onThemeChange={(theme) => choose({ ...choice, theme })}
        onDirChange={(dir) => choose({ ...choice, dir })}
      />
      {navOpen ? (
        <div
          data-shell-backdrop
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-wave-backdrop md:hidden"
          onClick={() => closeNav(false)}
        />
      ) : null}
      {ready && maximizeSlot
        ? createPortal(
            <MaximizeButton maximized={maximized} onToggle={toggleMaximized} />,
            maximizeSlot,
          )
        : null}
      {Palette ? (
        <Palette
          open={searchOpen}
          onClose={closeSearch}
          choice={choice}
          returnFocusRef={returnFocusRef}
        />
      ) : null}
    </>
  );
}
