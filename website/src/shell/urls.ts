/**
 * The app's addresses. `DOCS_BASE` is `base` of astro.config.mjs (a test keeps the two equal); it is
 * a constant rather than `import.meta.env.BASE_URL` because Astro's container renders with the base
 * `/` in tests, and the shell's links must be the built ones there too.
 */

/** Where the app lives: every page and asset is under it. */
export const DOCS_BASE = '/waveui/docs';

/**
 * The host that owns the docs' addresses: the homepage serves the app through a rewrite, so the same
 * HTML also answers on the app's own Vercel host. Every page names its address here as canonical,
 * so a search engine that reaches it on either host indexes this one (a `noindex` would hide the
 * homepage's copy too, which is the same document).
 */
export const CANONICAL_ORIGIN = 'https://brudvik.com';

/**
 * The canonical address of the page served at `pathname`: the homepage's origin and the path
 * without a trailing slash (the site redirects one away) or a file extension (clean URLs serve
 * `/button.html` as `/button`), the app's index as `DOCS_BASE` itself.
 */
export function canonicalUrl(pathname: string): string {
  const path = pathname
    .replace(/\.html$/, '')
    .replace(/\/index$/, '')
    .replace(/\/+$/, '');
  return `${CANONICAL_ORIGIN}${path}`;
}

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
