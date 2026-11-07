/**
 * The command bar at the top of the content: the hamburger (narrow screens), Copy code (only when
 * the page has code), Search, and the Theme and Direction choices. Presentational: the island
 * (`islands/ShellControls.tsx`) owns the state and renders it, so it is in the server HTML with
 * every control `disabled` until the island hydrates, and hidden without scripts, where none of
 * them could work.
 *
 * A group of WaveUI `Button`s, a `Hamburger` and two native `Select`s rather than a `Toolbar`:
 * arrow keys belong to the selects, and a toolbar's roving focus would add script for no gain.
 */
import type * as React from 'react';
// The library's modules, not its barrel: the build's chunking walks these imports (BUDGET.md).
import { Button } from '../../../src/components/button/Button';
import { Select } from '../../../src/components/input/Select';
import { Hamburger } from '../../../src/components/navigation/Hamburger';
import type { SiteChoice, SiteDir, SiteTheme } from '../theme/themeChoice';
import { SHELL_IDS } from './ids';

export type CopyStatus = 'idle' | 'copied' | 'failed';

export interface CommandBarProps {
  /** False until the island hydrates: every control is disabled. */
  ready: boolean;
  /** The code Copy code copies; without it there is no Copy code command. */
  copyText?: string | undefined;
  choice: SiteChoice;
  navOpen: boolean;
  copyStatus: CopyStatus;
  hamburgerRef?: React.Ref<HTMLButtonElement>;
  onToggleNav: () => void;
  onCopy: () => void;
  onSearch: () => void;
  onThemeChange: (theme: SiteTheme) => void;
  onDirChange: (dir: SiteDir) => void;
}

const THEME_OPTIONS: readonly { value: SiteTheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'high-contrast', label: 'High contrast' },
];

const DIR_OPTIONS: readonly { value: SiteDir; label: string }[] = [
  { value: 'ltr', label: 'Left to right' },
  { value: 'rtl', label: 'Right to left' },
];

const COPY_MESSAGES: Readonly<Record<CopyStatus, string>> = {
  idle: '',
  copied: 'Code copied',
  failed: 'Copy failed',
};

const ICON = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  'aria-hidden': true,
  focusable: false,
} as const;

function CopyGlyph() {
  return (
    <svg {...ICON}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1" />
      <path d="M3.5 10.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function SearchGlyph() {
  return (
    <svg {...ICON}>
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="m10 10 4.5 4.5" />
    </svg>
  );
}

const SELECT_CLASSES = 'w-auto';

export function CommandBar({
  ready,
  copyText,
  choice,
  navOpen,
  copyStatus,
  hamburgerRef,
  onToggleNav,
  onCopy,
  onSearch,
  onThemeChange,
  onDirChange,
}: CommandBarProps) {
  const disabled = !ready;
  return (
    <div
      role="group"
      aria-label="Page commands"
      className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-1 border-b border-wave-border bg-wave-background px-2 py-1 noscript:hidden"
    >
      <Hamburger
        ref={hamburgerRef}
        className="md:hidden"
        aria-expanded={navOpen}
        aria-controls={SHELL_IDS.nav}
        disabled={disabled}
        onClick={onToggleNav}
      />
      {copyText ? (
        <Button appearance="subtle" icon={<CopyGlyph />} disabled={disabled} onClick={onCopy}>
          Copy code
        </Button>
      ) : null}
      <Button
        appearance="subtle"
        icon={<SearchGlyph />}
        aria-keyshortcuts="Control+K Meta+K"
        disabled={disabled}
        onClick={onSearch}
      >
        Search
      </Button>
      <span className="ms-auto flex flex-wrap items-center gap-2">
        <Select
          aria-label="Theme"
          size="small"
          className={SELECT_CLASSES}
          value={choice.theme}
          disabled={disabled}
          onValueChange={(value) => onThemeChange(value as SiteTheme)}
        >
          {THEME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Direction"
          size="small"
          className={SELECT_CLASSES}
          value={choice.dir}
          disabled={disabled}
          onValueChange={(value) => onDirChange(value as SiteDir)}
        >
          {DIR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </span>
      <span aria-live="polite" className="sr-only">
        {COPY_MESSAGES[copyStatus]}
      </span>
    </div>
  );
}
