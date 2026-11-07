/**
 * The navigation pane: WaveUI's `Nav`, rendered on the server with no script, holding every
 * component of the catalog as a real link (`/waveui/docs/components/<slug>`), grouped by category
 * in the catalog's order. Each category is a list item holding its heading and the list the
 * heading labels; the current page's link carries `aria-current="page"` (Nav's `value`).
 *
 * Wide screens show it as the window's left pane (the right one in right to left). Below 48rem
 * (768px) it is a drawer while scripts run: hidden until the island's hamburger sets
 * `data-nav-open` on the window (site.css). Without scripts it stays in the page above the
 * content, so the links are always reachable.
 */
import { Nav } from '../../../src';
import { SHELL_IDS } from './ids';
import { componentHref } from './urls';

/** The part of a catalog entry the pane shows. */
export interface NavEntry {
  slug: string;
  name: string;
  category: string;
}

export interface NavGroup {
  category: string;
  entries: NavEntry[];
}

/** The entries by category, the categories and their entries in the order given. */
export function groupByCategory(entries: readonly NavEntry[]): NavGroup[] {
  const groups = new Map<string, NavEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.category);
    if (group) group.push(entry);
    else groups.set(entry.category, [entry]);
  }
  return [...groups].map(([category, items]) => ({ category, entries: items }));
}

const headingId = (category: string) =>
  `nav-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

export function NavPane({
  entries,
  current,
}: {
  entries: readonly NavEntry[];
  current?: string | undefined;
}) {
  return (
    <Nav
      id={SHELL_IDS.nav}
      aria-label="Components"
      value={current}
      density="small"
      className="shell-nav w-full shrink-0 border-e-0 border-b border-wave-border pb-4 md:w-60 md:overflow-y-auto md:border-e md:border-b-0"
    >
      {groupByCategory(entries).map(({ category, entries: items }) => (
        <li key={category}>
          <h2
            id={headingId(category)}
            className="px-4 pt-3 pb-1 text-wave-caption-1 font-semibold text-wave-muted-foreground"
          >
            {category}
          </h2>
          <ul aria-labelledby={headingId(category)}>
            {items.map((entry) => (
              <Nav.Item key={entry.slug} value={entry.slug} href={componentHref(entry.slug)}>
                {entry.name}
              </Nav.Item>
            ))}
          </ul>
        </li>
      ))}
    </Nav>
  );
}
