/**
 * The app's addresses. `DOCS_BASE` is `base` of astro.config.mjs (a test keeps the two equal); it is
 * a constant rather than `import.meta.env.BASE_URL` because Astro's container renders with the base
 * `/` in tests, and the shell's links must be the built ones there too.
 */

/** Where the app lives: every page and asset is under it. */
export const DOCS_BASE = '/waveui/docs';

/** The intro page on the homepage, outside the app: the title bar's Close goes there. */
export const INTRO_URL = '/waveui';

/** The address of a component page, `/waveui/docs/components/<slug>`. */
export function componentHref(slug: string): string {
  return `${DOCS_BASE}/components/${slug}`;
}

/** The search palette's index (`src/search/searchIndex.ts`), fetched on its first opening. */
export const SEARCH_INDEX_URL = `${DOCS_BASE}/_assets/search-index.json`;

/** A link of the navigation's Guides group. */
export interface GuideLink {
  id: 'getting-started' | 'theming' | 'changelog' | 'components';
  title: string;
  href: string;
}

/** The Guides group, at the top of the navigation: the three guide pages and the index. */
export const GUIDE_LINKS: readonly GuideLink[] = [
  { id: 'getting-started', title: 'Getting started', href: `${DOCS_BASE}/getting-started` },
  { id: 'theming', title: 'Theming', href: `${DOCS_BASE}/theming` },
  { id: 'changelog', title: 'Changelog', href: `${DOCS_BASE}/changelog` },
  { id: 'components', title: 'All components', href: `${DOCS_BASE}/components` },
];
