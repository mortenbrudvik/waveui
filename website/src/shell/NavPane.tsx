/**
 * The navigation pane: WaveUI's `Nav`, rendered on the server with no script. First the Guides
 * group (Getting started, Theming, Changelog, All components), then every component of the catalog
 * as a real link (`/waveui/docs/components/<slug>`), grouped by category in the catalog's order.
 * Each group is a list item holding its heading and the list the heading labels; the current
 * page's link carries `aria-current="page"` (Nav's `value`: a component's slug, or `guide:<id>`
 * for a link of the Guides group).
 *
 * Wide screens show it as the window's left pane (the right one in right to left). Below 48rem
 * (768px) it is a drawer while scripts run: hidden until the island's hamburger sets
 * `data-nav-open` on the window (site.css). Without scripts it stays in the page above the
 * content, so the links are always reachable.
 */
import { Nav } from '../../../src';
import { SHELL_IDS } from './ids';
import { componentHref, GUIDE_LINKS } from './urls';

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

/** The first group's heading: the guide pages and the components index. */
const GUIDES = 'Guides';

/**
 * A group's heading is set in capitals and a rule separates the group from the one above: without
 * them it read as one more link (the category `Button` over the page `Button`).
 */
const HEADING_CLASSES =
  'px-4 pt-3 pb-1 text-wave-caption-1 font-semibold tracking-wide text-wave-muted-foreground uppercase';

const SEPARATED_GROUP_CLASSES = 'mt-2 border-t border-wave-border';

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
      <li>
        <h2 id={headingId(GUIDES)} className={HEADING_CLASSES}>
          {GUIDES}
        </h2>
        <ul aria-labelledby={headingId(GUIDES)}>
          {GUIDE_LINKS.map((link) => (
            <Nav.Item key={link.id} value={`guide:${link.id}`} href={link.href}>
              {link.title}
            </Nav.Item>
          ))}
        </ul>
      </li>
      {groupByCategory(entries).map(({ category, entries: items }) => (
        <li key={category} className={SEPARATED_GROUP_CLASSES}>
          <h2 id={headingId(category)} className={HEADING_CLASSES}>
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
