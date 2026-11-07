/**
 * The search palette (the spec's "Search"): a modal dialog over component names, prop names and
 * the guide pages. It is lazy: the shell's island (`ShellControls.tsx`) imports this module on the
 * first Ctrl+K, Cmd+K or Search, so no page loads it on first load, and the palette fetches the
 * index (`/waveui/docs/_assets/search-index.json`) when it first opens.
 *
 * - WaveUI's `Dialog` (modal: focus trap, Escape, a click outside, focus back to where it was) in
 *   a `WaveProvider` with the page's theme and direction, so its portal follows them; the
 *   dialog's own motion, which reduced motion turns off.
 * - WaveUI's `Input` (with a search glyph) as a combobox (`aria-autocomplete="list"`,
 *   `aria-expanded`, `aria-controls`, `aria-activedescendant`): focus stays in it. ArrowDown and
 *   ArrowUp move the active result (wrapping), Enter follows it, Escape closes the palette, typing
 *   filters live (`searchEntries`: at most ten results). `Input` rather than `SearchBox`: its
 *   clear button and Escape-clears behaviour cost about 4 KB gzipped more in the lazy chunk, which
 *   the 40 KB target of the palette and its index could not afford (website/BUDGET.md).
 * - The results are a `listbox` of links (`role="option"`), so a click, or a middle click, is a
 *   link's; a status line says how many there are, or why there are none.
 */
import * as React from 'react';
// The library's modules, not its barrel: the build's chunking walks these imports (BUDGET.md).
import { Input } from '../../../src/components/input/Input';
import { Dialog } from '../../../src/components/overlays/Dialog';
import { WaveProvider } from '../../../src/components/provider/WaveProvider';
import { searchEntries, type SearchEntry } from '../search/match';
import { SEARCH_INDEX_URL } from '../shell/urls';
import type { SiteChoice } from '../theme/themeChoice';

export interface SearchPaletteProps {
  open: boolean;
  /** Called on Escape, a click outside, Close or a followed result. */
  onClose: () => void;
  /** The page's theme and direction. */
  choice: SiteChoice;
  /** Where focus returns on close (the element focused when the palette was asked for). */
  returnFocusRef: React.RefObject<HTMLElement | null>;
}

/** Loads the index. An object, so a test can replace the request. */
export const searchIndexSource = {
  load: async (): Promise<SearchEntry[]> => {
    const response = await fetch(SEARCH_INDEX_URL);
    if (!response.ok) throw new Error(`The search index answered ${response.status}`);
    return (await response.json()) as SearchEntry[];
  },
};

/** Follows a result chosen with Enter. An object, so a test can see where it goes. */
export const paletteNavigation = {
  go: (href: string): void => {
    window.location.assign(href);
  },
};

type IndexState =
  { status: 'loading' } | { status: 'failed' } | { status: 'ready'; entries: SearchEntry[] };

function SearchGlyph() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      aria-hidden
      focusable={false}
      className="text-wave-muted-foreground"
    >
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="m10 10 4.5 4.5" />
    </svg>
  );
}

const KIND_TEXT: Readonly<Record<SearchEntry['kind'], string>> = {
  component: 'Component',
  prop: 'Prop',
  page: 'Page',
};

interface ResultsProps {
  index: IndexState;
  onClose: () => void;
}

/** The input, the results and the status: mounted with each opening, so each starts empty. */
function PaletteBody({ index, onClose }: ResultsProps) {
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const results = React.useMemo(
    () => (index.status === 'ready' ? searchEntries(index.entries, query) : []),
    [index, query],
  );
  const activeIndex = results.length === 0 ? -1 : Math.min(active, results.length - 1);
  const optionId = (position: number) => `${listId}-option-${position}`;

  React.useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
  });

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const count = results.length;
    if (event.key === 'Escape') {
      // Escape closes the palette at once, whatever the text (the dialog's own handling skipped).
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      setActive((activeIndex + 1) % count);
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      setActive((activeIndex - 1 + count) % count);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const href = results[activeIndex]!.href;
      onClose();
      paletteNavigation.go(href);
    }
  };

  const trimmed = query.trim();
  let status: string;
  if (index.status === 'loading') status = 'Loading the search index…';
  else if (index.status === 'failed') status = 'Search is unavailable. Try again later.';
  else if (trimmed === '') status = 'Type a component, a prop or a guide.';
  else if (results.length === 0) status = `No results for “${trimmed}”`;
  else status = `${results.length} ${results.length === 1 ? 'result' : 'results'}`;

  const expanded = results.length > 0;
  return (
    <div className="flex flex-col gap-3">
      <Input
        autoFocus
        type="text"
        role="combobox"
        aria-label="Search the docs"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        placeholder="Search components, props and guides"
        contentBefore={<SearchGlyph />}
        value={query}
        onValueChange={(value) => {
          setQuery(value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="go"
        className="w-full"
      />
      <p role="status" className="m-0 text-wave-caption-1 text-wave-muted-foreground">
        {status}
      </p>
      <div
        id={listId}
        role="listbox"
        aria-label="Results"
        hidden={!expanded}
        className="m-0 flex flex-col gap-0.5 p-0"
      >
        {results.map((entry, position) => {
          const selected = position === activeIndex;
          return (
            <a
              key={`${entry.kind}:${entry.href}:${entry.label}`}
              id={optionId(position)}
              role="option"
              aria-selected={selected}
              data-active={selected ? '' : undefined}
              tabIndex={-1}
              href={entry.href}
              onPointerMove={() => {
                if (!selected) setActive(position);
              }}
              onClick={(event) => {
                // A plain click is followed here; a click that opens another tab or window keeps
                // the palette.
                if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                  onClose();
                }
              }}
              className="flex min-w-0 items-baseline justify-between gap-3 rounded px-3 py-2 text-wave-body-1 text-wave-foreground no-underline data-active:bg-wave-subtle-hover data-active:outline-2 data-active:outline-wave-ring forced-colors:data-active:outline-[Highlight]"
            >
              <span className="min-w-0 font-semibold break-words">{entry.label}</span>{' '}
              <span className="shrink-0 text-wave-caption-1 text-wave-muted-foreground">
                {entry.kind === 'component' && entry.detail ? entry.detail : KIND_TEXT[entry.kind]}
              </span>
            </a>
          );
        })}
      </div>
      <p className="m-0 text-wave-caption-1 text-wave-muted-foreground">
        Up and Down move between results, Enter opens one, Escape closes.
      </p>
    </div>
  );
}

export default function SearchPalette({
  open,
  onClose,
  choice,
  returnFocusRef,
}: SearchPaletteProps) {
  const [index, setIndex] = React.useState<IndexState>({ status: 'loading' });
  const requested = React.useRef(false);

  // The index is fetched when the palette first opens; after a failure, on the next opening.
  React.useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    searchIndexSource.load().then(
      (entries) => setIndex({ status: 'ready', entries }),
      () => {
        requested.current = false;
        setIndex({ status: 'failed' });
      },
    );
  }, [open]);

  const close = () => {
    // A failed index is fetched again on the next opening, which shows it loading meanwhile.
    if (index.status === 'failed') setIndex({ status: 'loading' });
    onClose();
  };

  return (
    <WaveProvider theme={choice.theme} dir={choice.dir}>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        finalFocusRef={returnFocusRef}
      >
        <Dialog.Content title="Search" size="medium">
          <PaletteBody index={index} onClose={close} />
        </Dialog.Content>
      </Dialog>
    </WaveProvider>
  );
}
