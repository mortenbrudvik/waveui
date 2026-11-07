/**
 * The search palette's matching (the spec's "Search"): a pure function over the entries of the
 * search index, shared by the palette and the tests.
 *
 * - Case-insensitive; the query's outer spaces are ignored and an empty query matches nothing.
 * - A label matches when it holds the query. A prefix match is strongest, then a match at the start
 *   of a word (after `.`, a space, `-` or `_`, or at a camel-case hump: `Grid` in `DataGrid`,
 *   `columns` in `DataGrid.columns`), then any other substring.
 * - Prefix and word-start matches rank above substring matches; among them components rank above
 *   guide pages, and pages above props; then the prefix above the word start, the shorter label
 *   first, and the label and address in code-unit order, so the order is total and stable.
 * - At most {@link MAX_RESULTS} results.
 */

/** One entry of the search index (`/waveui/docs/_assets/search-index.json`). */
export interface SearchEntry {
  /** A component's name, `Component.prop`, or a guide page's title. */
  label: string;
  kind: 'component' | 'prop' | 'page';
  /** The page the entry leads to (a prop's: its component's page, at the props table). */
  href: string;
  /** A component's category; absent for props and pages. */
  detail?: string;
}

/** The most results a search returns. */
export const MAX_RESULTS = 10;

/** 0: prefix; 1: word start; 2: other substring. */
export type MatchTier = 0 | 1 | 2;

const KIND_RANK: Readonly<Record<SearchEntry['kind'], number>> = {
  component: 0,
  page: 1,
  prop: 2,
};

const isLower = (char: string) => char !== char.toUpperCase() && char === char.toLowerCase();
const isUpper = (char: string) => char !== char.toLowerCase() && char === char.toUpperCase();
const isWordChar = (char: string) => /[\p{L}\p{N}]/u.test(char);

/** Whether a word starts at `index` of `label` (the original case, for the camel-case humps). */
function startsWord(label: string, index: number): boolean {
  if (index === 0) return true;
  const previous = label[index - 1]!;
  const current = label[index]!;
  if (!isWordChar(previous)) return true;
  if (isUpper(current) && isLower(previous)) return true;
  // The last capital of a run that starts a word: `Input` in `HTMLInput`.
  const next = label[index + 1];
  return isUpper(current) && isUpper(previous) && next !== undefined && isLower(next);
}

/**
 * How `label` matches `query` (already trimmed): its strongest occurrence, or `null` when it does
 * not hold the query.
 */
export function matchTier(label: string, query: string): MatchTier | null {
  const haystack = label.toLowerCase();
  const needle = query.toLowerCase();
  if (needle === '') return null;
  let index = haystack.indexOf(needle);
  if (index === -1) return null;
  if (index === 0) return 0;
  while (index !== -1) {
    if (startsWord(label, index)) return 1;
    index = haystack.indexOf(needle, index + 1);
  }
  return 2;
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The entries matching `query`, best first, at most `limit` of them. */
export function searchEntries(
  entries: readonly SearchEntry[],
  query: string,
  limit: number = MAX_RESULTS,
): SearchEntry[] {
  const needle = query.trim();
  if (needle === '') return [];
  const scored: { entry: SearchEntry; tier: MatchTier }[] = [];
  for (const entry of entries) {
    const tier = matchTier(entry.label, needle);
    if (tier !== null) scored.push({ entry, tier });
  }
  scored.sort(
    (a, b) =>
      Number(a.tier === 2) - Number(b.tier === 2) ||
      KIND_RANK[a.entry.kind] - KIND_RANK[b.entry.kind] ||
      a.tier - b.tier ||
      a.entry.label.length - b.entry.label.length ||
      compareText(a.entry.label, b.entry.label) ||
      compareText(a.entry.href, b.entry.href),
  );
  return scored.slice(0, limit).map((item) => item.entry);
}
