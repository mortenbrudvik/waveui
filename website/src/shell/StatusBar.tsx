/**
 * The status bar: build-measured facts only (the spec's "Status bar"). It shows the values it is
 * given and nothing else; with none it stays in the layout, empty, so every page has the same
 * window. Rendered on the server, no script.
 */

/** What a page may show in the status bar. */
export interface ShellStatus {
  /** The component's production import size (`src/docs/sizes.ts`). */
  importSize?: { minified: number; gzip: number };
  /** The library version the site is built from. */
  version: string;
}

/** Bytes as kilobytes of 1024 bytes with one decimal: `12425` is `12.1 KB`. */
export function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function StatusBar({ status }: { status?: ShellStatus | undefined }) {
  return (
    <footer className="flex min-h-7 shrink-0 flex-wrap items-center gap-x-6 border-t border-wave-border bg-wave-muted px-3 text-wave-caption-1 text-wave-muted-foreground">
      {status?.importSize ? (
        <span>{`Import: ${formatKB(status.importSize.minified)} min / ${formatKB(status.importSize.gzip)} gz`}</span>
      ) : null}
      {status ? <span>{`Version ${status.version}`}</span> : null}
    </footer>
  );
}
