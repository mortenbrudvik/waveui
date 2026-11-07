/**
 * The title bar of the app window: an app icon and a drag surface (decorative, `aria-hidden`), the
 * page title, and the window controls at the inline end, Maximize/Restore and Close (no minimize).
 * A flex row with logical spacing, so right to left puts the controls on the left, as Windows does.
 *
 * `TitleBar` is rendered on the server with no script. Close is a link to the intro page; the
 * Maximize/Restore button needs script, so the island renders {@link MaximizeButton} into the
 * reserved place (`SHELL_IDS.maximizeSlot`) once it hydrates. That place keeps its width before
 * then (no layout shift) and is hidden without scripts and on narrow screens, where the window
 * always fills the screen.
 */
import { SHELL_IDS } from './ids';
import { INTRO_URL } from './urls';

const CONTROL_BASE =
  'inline-flex w-12 items-center justify-center text-wave-foreground no-underline transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wave-ring';

/** The look of a window control (Maximize/Restore). */
export const WINDOW_CONTROL_CLASSES = `${CONTROL_BASE} hover:bg-wave-subtle-hover active:bg-wave-subtle-pressed`;

const CLOSE_CLASSES = `${CONTROL_BASE} hover:bg-wave-destructive hover:text-wave-destructive-foreground active:bg-wave-destructive active:text-wave-destructive-foreground`;

const GLYPH = {
  width: 10,
  height: 10,
  viewBox: '0 0 10 10',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1,
  'aria-hidden': true,
  focusable: false,
} as const;

function CloseGlyph() {
  return (
    <svg {...GLYPH} data-glyph="close">
      <path d="M0.5 0.5 9.5 9.5M9.5 0.5 0.5 9.5" />
    </svg>
  );
}

function MaximizeGlyph() {
  return (
    <svg {...GLYPH} data-glyph="maximize">
      <rect x="0.5" y="0.5" width="9" height="9" />
    </svg>
  );
}

/** Two overlapping windows; mirrored in right to left, like the window chrome. */
function RestoreGlyph() {
  return (
    <svg {...GLYPH} data-glyph="restore" className="wave-rtl:-scale-x-100">
      <rect x="0.5" y="2.5" width="7" height="7" />
      <path d="M2.5 2.5V0.5h7v7h-2" />
    </svg>
  );
}

/**
 * The Maximize/Restore window control. Its name says what a press does: "Maximize" while the
 * window is centered, "Restore" while it fills the screen.
 */
export function MaximizeButton({
  maximized,
  onToggle,
}: {
  maximized: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={maximized ? 'Restore' : 'Maximize'}
      className={WINDOW_CONTROL_CLASSES}
      onClick={onToggle}
    >
      {maximized ? <RestoreGlyph /> : <MaximizeGlyph />}
    </button>
  );
}

export function TitleBar({ title }: { title: string }) {
  return (
    <header className="flex h-10 shrink-0 items-stretch border-b border-wave-border bg-wave-muted select-none md:h-9">
      <span data-shell-chrome aria-hidden="true" className="flex shrink-0 items-center px-3">
        <span className="block size-4 rounded-sm bg-wave-primary" />
      </span>
      <p
        data-shell-title
        className="min-w-0 self-center truncate text-wave-caption-1 text-wave-foreground"
      >
        {title}
      </p>
      <span data-shell-chrome aria-hidden="true" className="min-w-6 flex-1" />
      <div data-shell-controls className="ms-auto flex items-stretch">
        <span id={SHELL_IDS.maximizeSlot} className="hidden w-12 md:flex noscript:hidden" />
        <a href={INTRO_URL} aria-label="Close" className={CLOSE_CLASSES}>
          <CloseGlyph />
        </a>
      </div>
    </header>
  );
}
