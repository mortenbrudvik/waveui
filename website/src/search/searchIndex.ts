/**
 * The search palette's index (the spec's "Search": "an index built at build time and loaded only
 * when opened"), served as `/waveui/docs/_assets/search-index.json` by the endpoint
 * `src/pages/[assets]/search-index.json.ts`:
 *
 * - every component of the catalog: its name, its page, its category as `detail`;
 * - every prop of a component page's props table, as `Component.prop`, leading to that table
 *   (`#props`); a hook's page has no props table, so it has no prop entries;
 * - the guide pages and the components index.
 *
 * Components, then pages, then props, each in code-unit order of the label, whatever the order of
 * the input, so two builds of the same sources write the same file.
 */
import { getCatalog } from '../catalog/catalog';
import { GUIDE_LINKS } from '../docs/guides';
import { isHookEntry } from '../docs/page';
import { extractDocs } from '../docs/props';
import { componentHref } from '../shell/urls';
import type { SearchEntry } from './match';

export { SEARCH_INDEX_URL } from '../shell/urls';

/** A component as the index needs it; `props` is `null` when its page has no props table. */
export interface IndexedComponent {
  name: string;
  slug: string;
  category: string;
  props: readonly string[] | null;
}

/** A guide page (or the components index) as the index needs it. */
export interface IndexedPage {
  title: string;
  href: string;
}

const KIND_ORDER: Readonly<Record<SearchEntry['kind'], number>> = {
  component: 0,
  page: 1,
  prop: 2,
};

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The index of the given components and pages, in its stable order. */
export function buildSearchIndex(
  components: readonly IndexedComponent[],
  pages: readonly IndexedPage[],
): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const component of components) {
    const href = componentHref(component.slug);
    entries.push({ label: component.name, kind: 'component', href, detail: component.category });
    for (const prop of component.props ?? []) {
      entries.push({ label: `${component.name}.${prop}`, kind: 'prop', href: `${href}#props` });
    }
  }
  for (const page of pages) entries.push({ label: page.title, kind: 'page', href: page.href });
  return entries.sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      compareText(a.label, b.label) ||
      compareText(a.href, b.href),
  );
}

/** The site's index: the catalog's components with their documented props, and the guides. */
export function readSearchIndex(): SearchEntry[] {
  const components = getCatalog().map((entry): IndexedComponent => {
    const docs = extractDocs(entry);
    const hasTable = !isHookEntry(entry) && docs.props.length > 0;
    return {
      name: entry.name,
      slug: entry.slug,
      category: entry.category,
      props: hasTable ? docs.props.map((prop) => prop.name) : null,
    };
  });
  return buildSearchIndex(
    components,
    GUIDE_LINKS.map(({ title, href }) => ({ title, href })),
  );
}

/** The index file's text: compact JSON. */
export function serialiseSearchIndex(entries: readonly SearchEntry[]): string {
  return JSON.stringify(entries);
}
