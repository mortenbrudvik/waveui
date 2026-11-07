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
 * - Search, which dispatches `SEARCH_EVENT` (the command palette listens).
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
import { saveChoice, type SiteChoice, type SiteTheme } from '../theme/themeChoice';

export interface ShellControlsProps {
  /** The text Copy code copies (the page's first story's source); without it, no Copy code. */
  copyText?: string | undefined;
}

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

function readChoice(): SiteChoice {
  const html = document.documentElement;
  return {
    theme: THEMES.find((theme) => html.classList.contains(`wave-${theme}`)) ?? 'light',
    dir: html.dir === 'rtl' ? 'rtl' : 'ltr',
  };
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

  React.useEffect(() => {
    setChoice(readChoice());
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
    const nav = byId(SHELL_IDS.nav);
    nav?.querySelector<HTMLElement>('[aria-current="page"], a[href]')?.focus();
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
    </>
  );
}
