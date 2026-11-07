/**
 * The app shell, tested as the browser gets it: `AppLayout.astro` is rendered to HTML by Astro's
 * container API (the same server rendering as the build), the HTML is parsed into jsdom with no
 * script run (the page "with scripts off"), and the one island, `ShellControls`, is then hydrated
 * onto its server markup with Testing Library, as Astro's React renderer does on idle.
 *
 * The suite runs in the `shell` Vitest project (vitest.config.ts): jsdom globals with the SSR
 * transform, which `.astro` files need.
 */
import { readFileSync } from 'node:fs';
import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { hydrateRoot, type Root } from 'react-dom/client';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import astroConfig from '../../astro.config.mjs';
import { getCatalog } from '../catalog/catalog';
import ShellControls from '../islands/ShellControls';
import AppLayout from '../layouts/AppLayout.astro';
import { STORAGE_KEY, saveChoice } from '../theme/themeChoice';
import { CHOICE_EVENT, SEARCH_EVENT } from './events';
import { SHELL_IDS } from './ids';
import { formatKB } from './StatusBar';
import { DOCS_BASE, GUIDE_LINKS, componentHref } from './urls';
import { MAXIMIZED_KEY, WINDOW_INIT_SCRIPT } from './windowState';

vi.mock('../theme/themeChoice', async (importOriginal) => {
  const original = await importOriginal<typeof import('../theme/themeChoice')>();
  return { ...original, saveChoice: vi.fn(original.saveChoice) };
});

type LayoutProps = {
  title: string;
  current?: string;
  status?: { importSize?: { minified: number; gzip: number }; version: string };
  copyText?: string;
};

const CONTENT = '<h1>Button</h1><p>Buttons start an action.</p>';
const STORY_SOURCE = '<Button appearance="primary">Save</Button>';

let container: AstroContainer;

async function renderLayout(props: LayoutProps, content = CONTENT): Promise<string> {
  return container.renderToString(AppLayout, { props, slots: { default: content } });
}

/** The page's HTML as an inert document: no script runs, as with scripts off. */
function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function copyAttributes(from: Element, to: Element): void {
  for (const { name } of [...to.attributes]) to.removeAttribute(name);
  for (const { name, value } of from.attributes) to.setAttribute(name, value);
}

/**
 * Puts the page into the live jsdom document (no script runs). The `<html>`, `<head>` and `<body>`
 * elements stay (Testing Library's `screen` is bound to the body); their attributes and content
 * are the page's.
 */
function load(html: string): void {
  const page = parse(html);
  copyAttributes(page.documentElement, document.documentElement);
  copyAttributes(page.body, document.body);
  document.head.innerHTML = page.head.innerHTML;
  document.body.innerHTML = page.body.innerHTML;
}

let root: Root | undefined;

/**
 * Hydrates the island on its server markup, as Astro's React renderer does on idle (`hydrateRoot`
 * with the island's `prefix` as the id prefix). A hydration mismatch fails the test.
 */
async function hydrateIsland(copyText?: string): Promise<void> {
  const island = document.querySelector('astro-island');
  if (!island) throw new Error('no astro-island in the page');
  // Astro's island script removes its end marker before it hydrates.
  for (const node of [...island.childNodes]) {
    if (node.nodeType === Node.COMMENT_NODE && node.nodeValue === 'astro:end') node.remove();
  }
  const errors: unknown[] = [];
  await act(async () => {
    root = hydrateRoot(island, <ShellControls copyText={copyText} />, {
      identifierPrefix: island.getAttribute('prefix') ?? undefined,
      onRecoverableError: (error) => errors.push(error),
    });
  });
  expect(errors).toEqual([]);
}

const shellWindow = (doc: Document = document) => doc.getElementById(SHELL_IDS.window)!;

const TABBABLE =
  'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]';

function tabOrder(doc: Document = document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => el.tabIndex >= 0 && !el.closest('[hidden], [inert]'),
  );
}

const catalog = getCatalog();

beforeAll(async () => {
  container = await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
  });
});

beforeEach(() => {
  localStorage.clear();
  vi.mocked(saveChoice).mockClear();
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const element of [document.documentElement, document.body]) {
    for (const { name } of [...element.attributes]) element.removeAttribute(name);
  }
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('AppLayout (server-rendered HTML)', () => {
  it('has landmarks: banner-like title bar, nav, main, status', async () => {
    const doc = parse(await renderLayout({ title: 'Button', current: 'button' }));
    const header = doc.querySelector('header');
    // A <header> that is no descendant of a sectioning element or <main> is the banner landmark.
    expect(header).not.toBeNull();
    expect(header!.closest('main, article, aside, nav, section')).toBeNull();
    const nav = doc.querySelectorAll('nav');
    expect(nav).toHaveLength(1);
    expect(nav[0]!.getAttribute('aria-label')).toBe('Components');
    const main = doc.querySelectorAll('main');
    expect(main).toHaveLength(1);
    expect(main[0]!.id).toBe('main');
    expect(main[0]!.innerHTML).toContain(CONTENT);
    // The status bar is the page's footer (contentinfo); it is no live region.
    const footer = doc.querySelector('footer');
    expect(footer).not.toBeNull();
    expect(footer!.closest('main, article, aside, nav, section')).toBeNull();
    expect(footer!.getAttribute('role')).toBeNull();
    expect(footer!.getAttribute('aria-live')).toBeNull();
    // The static markup is light and left to right; the inline script changes both before paint.
    expect(doc.documentElement.getAttribute('lang')).toBe('en');
    expect(doc.documentElement.getAttribute('dir')).toBe('ltr');
    expect(doc.documentElement.className).toBe('wave-light');
    expect(doc.title).toBe('Button · WaveUI docs');
  });

  it('inlines the theme script in the head and the window script in the window', async () => {
    const doc = parse(await renderLayout({ title: 'Button' }));
    const headScripts = [...doc.head.querySelectorAll('script')].map((s) => s.textContent);
    expect(headScripts).toContain((await import('../theme/themeInit')).THEME_INIT_SCRIPT);
    const windowScript = shellWindow(doc).firstElementChild;
    expect(windowScript?.tagName).toBe('SCRIPT');
    expect(windowScript?.textContent).toBe(WINDOW_INIT_SCRIPT);
    // No web fonts: no font file, no font stylesheet, no @font-face.
    expect(doc.querySelectorAll('link[rel="preload"][as="font"]')).toHaveLength(0);
    expect(doc.documentElement.outerHTML).not.toMatch(/fonts\.googleapis|@font-face|\.woff2?/);
  });

  it('nav lists the guides first, then every category and all 80 component links, current marked aria-current="page"', async () => {
    const doc = parse(await renderLayout({ title: 'Data grid', current: 'data-grid' }));
    const nav = doc.querySelector('nav')!;
    const categories = [...new Set(catalog.map((entry) => entry.category))];
    // One labelled group per category, in the catalog's order, after the Guides group: a heading
    // and the list it names.
    const groups = [...nav.querySelectorAll('ul[aria-labelledby]')];
    expect(
      groups.map((list) => doc.getElementById(list.getAttribute('aria-labelledby')!)?.textContent),
    ).toEqual(['Guides', ...categories]);
    for (const list of groups) {
      expect(doc.getElementById(list.getAttribute('aria-labelledby')!)?.tagName).toBe('H2');
    }
    // Guides: the three guide pages and the components index, exactly four links.
    const [guides, ...categoryGroups] = groups;
    const guideLinks = [...guides!.querySelectorAll('a')];
    expect(guideLinks.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Getting started', '/waveui/docs/getting-started'],
      ['Theming', '/waveui/docs/theming'],
      ['Changelog', '/waveui/docs/changelog'],
      ['All components', '/waveui/docs/components'],
    ]);
    expect(GUIDE_LINKS.map((link) => link.href)).toEqual(
      guideLinks.map((a) => a.getAttribute('href')),
    );
    // Components: the 80, exactly, under the categories.
    const links = categoryGroups.flatMap((list) => [...list.querySelectorAll('a')]);
    expect(links).toHaveLength(80);
    expect(nav.querySelectorAll('a')).toHaveLength(80 + 4);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      catalog.map((entry) => `/waveui/docs/components/${entry.slug}`),
    );
    expect(links.map((a) => a.textContent)).toEqual(catalog.map((entry) => entry.name));
    const current = [...nav.querySelectorAll('a')].filter((a) => a.hasAttribute('aria-current'));
    expect(current).toHaveLength(1);
    expect(current[0]!.getAttribute('aria-current')).toBe('page');
    expect(current[0]!.getAttribute('href')).toBe('/waveui/docs/components/data-grid');
    // Each category's links sit in its own group.
    for (const [index, list] of categoryGroups.entries()) {
      expect([...list.querySelectorAll('a')].map((a) => a.textContent)).toEqual(
        catalog.filter((entry) => entry.category === categories[index]).map((e) => e.name),
      );
    }
  });

  it('marks no link current without a current page', async () => {
    const doc = parse(await renderLayout({ title: 'WaveUI docs' }));
    expect(doc.querySelectorAll('nav [aria-current]')).toHaveLength(0);
  });

  it('title bar chrome is aria-hidden except the controls, which are buttons with names', async () => {
    load(await renderLayout({ title: 'Button', current: 'button' }));
    await hydrateIsland();
    const header = document.querySelector('header')!;
    const decorative = [...header.querySelectorAll('[data-shell-chrome]')];
    // The app icon and the drag surface.
    expect(decorative).toHaveLength(2);
    for (const element of decorative) expect(element.getAttribute('aria-hidden')).toBe('true');
    // The title is readable text.
    expect(header.textContent).toContain('Button');
    expect(header.querySelector('[data-shell-title]')?.closest('[aria-hidden]')).toBeNull();
    // The controls: Maximize (a button) and Close (a link), named, and not hidden.
    const controls = within(header);
    const maximize = controls.getByRole('button', { name: 'Maximize' });
    const close = controls.getByRole('link', { name: 'Close' });
    expect(maximize.tagName).toBe('BUTTON');
    expect(maximize.getAttribute('type')).toBe('button');
    for (const control of [maximize, close]) {
      expect(control.closest('[aria-hidden]')).toBeNull();
    }
    // They are the title bar's only tab stops, and there is no minimize.
    expect(tabOrder().filter((el) => header.contains(el))).toEqual([maximize, close]);
    expect(controls.queryByRole('button', { name: /minimi[sz]e/i })).toBeNull();
    // Their glyphs are decorative.
    for (const svg of header.querySelectorAll('svg')) {
      expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('close is a link to /waveui', async () => {
    const doc = parse(await renderLayout({ title: 'Button' }));
    const close = doc.querySelector('header a[aria-label="Close"]');
    expect(close?.getAttribute('href')).toBe('/waveui');
  });

  it('with scripts off the nav and content are present', async () => {
    const html = await renderLayout({ title: 'Button', current: 'button', copyText: STORY_SOURCE });
    const doc = parse(html);
    // Before hydration: the 80 component links and the 4 guide links, the content and the skip
    // link are in the HTML.
    expect(doc.querySelectorAll(`nav#${SHELL_IDS.nav} a[href*="/components/"]`)).toHaveLength(80);
    expect(doc.querySelectorAll(`nav#${SHELL_IDS.nav} a[href]`)).toHaveLength(80 + 4);
    expect(doc.querySelector('main')!.textContent).toContain('Buttons start an action.');
    expect(doc.querySelector('a[href="#main"]')?.textContent).toBe('Skip to content');
    // The island's controls are rendered but unavailable until it hydrates; the maximize button
    // is rendered only by the hydrated island.
    const island = doc.querySelector('astro-island')!;
    expect(island.getAttribute('client')).toBe('idle');
    const commands = [...island.querySelectorAll('button, select')];
    expect(commands.length).toBeGreaterThan(0);
    for (const command of commands) expect(command.hasAttribute('disabled')).toBe(true);
    expect(doc.querySelector('header button')).toBeNull();
    // The nav is no drawer without scripts: the site sheet hides it on narrow screens only while
    // scripting is enabled, and the command bar and the maximize slot hide without scripts.
    const css = readFileSync(new URL('../styles/site.css', import.meta.url), 'utf8');
    expect(css).toMatch(
      /@media \(max-width: 47\.99rem\) and \(scripting: enabled\) \{\s*\.shell-nav \{\s*display: none;/,
    );
    expect(css).toMatch(/@custom-variant noscript \(@media \(scripting: none\)\);/);
    expect(island.querySelector('[role="group"]')?.className).toMatch(
      /(^|\s)noscript:hidden(\s|$)/,
    );
    expect(doc.getElementById(SHELL_IDS.maximizeSlot)?.className).toMatch(
      /(^|\s)noscript:hidden(\s|$)/,
    );
  });

  it('the status bar renders only the values it is given', async () => {
    const footerOf = async (status?: LayoutProps['status']) =>
      parse(await renderLayout({ title: 'Button', status })).querySelector('footer')!;

    const full = await footerOf({
      importSize: { minified: 12_425, gzip: 4_710 },
      version: '1.1.0',
    });
    expect(full.textContent).toBe('Import: 12.1 KB min / 4.6 KB gzVersion 1.1.0');
    expect([...full.children].map((child) => child.textContent)).toEqual([
      'Import: 12.1 KB min / 4.6 KB gz',
      'Version 1.1.0',
    ]);

    const versionOnly = await footerOf({ version: '1.1.0' });
    expect([...versionOnly.children].map((child) => child.textContent)).toEqual(['Version 1.1.0']);

    // Nothing given, nothing shown; the bar stays in the layout.
    const empty = await footerOf(undefined);
    expect(empty.children).toHaveLength(0);
    expect(empty.textContent).toBe('');
  });

  it('formats bytes as KB with one decimal, base 1024', () => {
    expect(formatKB(0)).toBe('0.0 KB');
    expect(formatKB(1024)).toBe('1.0 KB');
    expect(formatKB(1536)).toBe('1.5 KB');
    expect(formatKB(12_425)).toBe('12.1 KB');
    expect(formatKB(87_474)).toBe('85.4 KB');
    expect(formatKB(1_048_576)).toBe('1024.0 KB');
  });

  it('the layout declares @view-transition { navigation: auto } and gives the window view-transition-name: waveui-window, turned off under prefers-reduced-motion', async () => {
    const layout = readFileSync(new URL('../layouts/AppLayout.astro', import.meta.url), 'utf8');
    expect(layout).toMatch(
      /import '\.\.\/styles\/library\.css';\s+import '\.\.\/styles\/site\.css';/,
    );
    const css = readFileSync(new URL('../styles/site.css', import.meta.url), 'utf8');
    const reduced = css.indexOf('@media (prefers-reduced-motion: reduce) {');
    expect(reduced).toBeGreaterThan(0);
    const outside = css.slice(0, reduced);
    const inside = css.slice(reduced, css.indexOf('\n}\n', reduced));
    expect(outside).toMatch(/@view-transition \{\s*navigation: auto;\s*\}/);
    expect(outside).toMatch(/\.shell-window \{\s*view-transition-name: waveui-window;\s*\}/);
    expect(inside).toMatch(/@view-transition \{\s*navigation: none;\s*\}/);
    expect(inside).toMatch(/\.shell-window \{\s*view-transition-name: none;\s*\}/);
    // The window element carries the class.
    const doc = parse(await renderLayout({ title: 'Button' }));
    expect(shellWindow(doc).classList.contains('shell-window')).toBe(true);
    expect(shellWindow(doc).hasAttribute('data-maximized')).toBe(false);
  });

  it('rtl moves the window controls to the left', async () => {
    load(await renderLayout({ title: 'Button', current: 'button' }));
    await hydrateIsland();
    document.documentElement.dir = 'rtl';
    const header = document.querySelector('header')!;
    // The title bar is a flex row, which follows the direction: its controls sit at the inline end,
    // the right in left to right and the left in right to left.
    expect(header.className).toMatch(/(^|\s)flex(\s|$)/);
    const controls = header.querySelector('[data-shell-controls]')!;
    expect(controls.className).toMatch(/(^|\s)ms-auto(\s|$)/);
    expect(header.lastElementChild).toBe(controls);
    // The restore glyph mirrors, as Windows mirrors it.
    await userEvent.click(screen.getByRole('button', { name: 'Maximize' }));
    expect(header.querySelector('[data-glyph="restore"]')?.getAttribute('class')).toMatch(
      /(^|\s)wave-rtl:-scale-x-100(\s|$)/,
    );
    // No physical direction anywhere in the shell: no left or right utilities or styles.
    const physical =
      /(^|\s|:)-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|text-left|text-right|float-left|float-right|scroll-ml|scroll-mr)(-|\s|$)/;
    for (const element of document.body.querySelectorAll('[class]')) {
      expect(element.getAttribute('class'), element.outerHTML.slice(0, 120)).not.toMatch(physical);
    }
    expect(document.body.innerHTML).not.toMatch(/style="[^"]*\b(left|right)\s*:/);
  });

  it('no tab stop is trapped: Tab order is skip link, title controls, nav, main', async () => {
    load(
      await renderLayout(
        { title: 'Button', current: 'button', copyText: STORY_SOURCE },
        `${CONTENT}<a href="#top">Top</a>`,
      ),
    );
    await hydrateIsland(STORY_SOURCE);
    const order = tabOrder();
    expect(
      document.querySelectorAll('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])'),
    ).toHaveLength(0);
    const nav = document.querySelector('nav')!;
    const main = document.querySelector('main')!;
    expect(order[0]!.textContent).toBe('Skip to content');
    expect(order[0]!.getAttribute('href')).toBe('#main');
    expect(order[1]!.getAttribute('aria-label')).toBe('Maximize');
    expect(order[2]!.getAttribute('aria-label')).toBe('Close');
    // The 4 guide links, then the 80 component links.
    const navStops = order.slice(3, 3 + 4 + 80);
    expect(navStops.every((el) => nav.contains(el))).toBe(true);
    expect(navStops.slice(0, 4).map((el) => el.getAttribute('href'))).toEqual(
      GUIDE_LINKS.map((link) => link.href),
    );
    const rest = order.slice(3 + 4 + 80);
    expect(rest.length).toBeGreaterThan(0);
    expect(rest.every((el) => main.contains(el))).toBe(true);
    expect(rest.at(-1)!.textContent).toBe('Top');
    // The skip link's target takes focus.
    expect(main.tabIndex).toBe(-1);
    // Tab really moves through them in that order (Testing Library's Tab follows the DOM order).
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(order[0]);
    await user.tab();
    expect(document.activeElement).toBe(order[1]);
    await user.tab();
    expect(document.activeElement).toBe(order[2]);
    await user.tab();
    expect(document.activeElement).toBe(order[3]);
  });

  it('axe finds no violations on the shell', async () => {
    load(
      await renderLayout({
        title: 'Button',
        current: 'button',
        copyText: STORY_SOURCE,
        status: { importSize: { minified: 12_425, gzip: 4_710 }, version: '1.1.0' },
      }),
    );
    await hydrateIsland(STORY_SOURCE);
    const results = await axe.run(document, {
      // jsdom cannot compute contrast (src/test-utils.ts); the token tests guard it per theme.
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`),
    ).toEqual([]);
  });
});

describe('ShellControls (the island)', () => {
  async function mount(copyText?: string) {
    load(await renderLayout({ title: 'Button', current: 'button', copyText }));
    await hydrateIsland(copyText);
  }

  it('enables its controls once hydrated', async () => {
    await mount(STORY_SOURCE);
    for (const command of document.querySelectorAll('astro-island button, astro-island select')) {
      expect(command.hasAttribute('disabled')).toBe(false);
    }
  });

  it('maximize toggles data-maximized on the window and its label changes between "Maximize" and "Restore"', async () => {
    await mount();
    const user = userEvent.setup();
    const win = shellWindow();
    expect(win.hasAttribute('data-maximized')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Maximize' }));
    expect(win.hasAttribute('data-maximized')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Maximize' })).toBeNull();
    expect(localStorage.getItem(MAXIMIZED_KEY)).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(win.hasAttribute('data-maximized')).toBe(false);
    expect(screen.getByRole('button', { name: 'Maximize' })).toBeDefined();
    expect(localStorage.getItem(MAXIMIZED_KEY)).toBe('0');
  });

  it('starts as Restore when the window script restored a maximized window', async () => {
    load(await renderLayout({ title: 'Button' }));
    shellWindow().setAttribute('data-maximized', '');
    await hydrateIsland();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDefined();
  });

  // user-event's setup() puts a clipboard of its own on `navigator`; the spies go on it after.
  it("copy code copies the source text of the page's first story", async () => {
    await mount(STORY_SOURCE);
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    await user.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(STORY_SOURCE);
    await waitFor(() =>
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('Code copied'),
    );
  });

  it('announces a failed copy', async () => {
    await mount(STORY_SOURCE);
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    await user.click(screen.getByRole('button', { name: 'Copy code' }));
    await waitFor(() =>
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('Copy failed'),
    );
  });

  it('omits copy code when the page has no code', async () => {
    await mount();
    expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();
  });

  it('theme and direction changes call saveChoice and update <html>', async () => {
    await mount();
    const user = userEvent.setup();
    const html = document.documentElement;
    html.classList.add('site');
    const choices: unknown[] = [];
    const listener = (event: Event) => choices.push((event as CustomEvent).detail);
    window.addEventListener(CHOICE_EVENT, listener);
    try {
      await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'dark');
      expect([...html.classList].sort()).toEqual(['site', 'wave-dark']);
      expect(saveChoice).toHaveBeenLastCalledWith(localStorage, { theme: 'dark', dir: 'ltr' });
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ theme: 'dark', dir: 'ltr' });

      await user.selectOptions(screen.getByRole('combobox', { name: 'Direction' }), 'rtl');
      expect(html.getAttribute('dir')).toBe('rtl');
      expect(saveChoice).toHaveBeenLastCalledWith(localStorage, { theme: 'dark', dir: 'rtl' });

      await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'high-contrast');
      expect([...html.classList].sort()).toEqual(['site', 'wave-high-contrast']);
      expect(saveChoice).toHaveBeenCalledTimes(3);
      expect(choices).toEqual([
        { theme: 'dark', dir: 'ltr' },
        { theme: 'dark', dir: 'rtl' },
        { theme: 'high-contrast', dir: 'rtl' },
      ]);
    } finally {
      window.removeEventListener(CHOICE_EVENT, listener);
    }
  });

  it('shows the choice the head script applied', async () => {
    load(await renderLayout({ title: 'Button' }));
    document.documentElement.className = 'wave-high-contrast';
    document.documentElement.dir = 'rtl';
    await hydrateIsland();
    expect((screen.getByRole('combobox', { name: 'Theme' }) as HTMLSelectElement).value).toBe(
      'high-contrast',
    );
    expect((screen.getByRole('combobox', { name: 'Direction' }) as HTMLSelectElement).value).toBe(
      'rtl',
    );
  });

  it('a storage that throws keeps the change for the page', async () => {
    await mount();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      await userEvent
        .setup()
        .selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'dark');
      expect(document.documentElement.classList.contains('wave-dark')).toBe(true);
      await userEvent.setup().click(screen.getByRole('button', { name: 'Maximize' }));
      expect(shellWindow().hasAttribute('data-maximized')).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('search dispatches the open-search event', async () => {
    await mount();
    const listener = vi.fn();
    window.addEventListener(SEARCH_EVENT, listener);
    try {
      await userEvent.setup().click(screen.getByRole('button', { name: 'Search' }));
      expect(listener).toHaveBeenCalledOnce();
      expect(SEARCH_EVENT).toBe('waveui:open-search');
    } finally {
      window.removeEventListener(SEARCH_EVENT, listener);
    }
  });

  it('the hamburger opens the navigation drawer, and Escape closes it', async () => {
    await mount();
    const user = userEvent.setup();
    const win = shellWindow();
    const hamburger = screen.getByRole('button', { name: 'Navigation' });
    expect(hamburger.getAttribute('aria-controls')).toBe(SHELL_IDS.nav);
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    await user.click(hamburger);
    expect(win.hasAttribute('data-nav-open')).toBe(true);
    expect(hamburger.getAttribute('aria-expanded')).toBe('true');
    // Focus moves to the current page's link.
    expect(document.activeElement?.getAttribute('aria-current')).toBe('page');
    await user.keyboard('{Escape}');
    expect(win.hasAttribute('data-nav-open')).toBe(false);
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(hamburger);
  });

  it('the drawer closes when focus leaves it or its backdrop is clicked', async () => {
    await mount(STORY_SOURCE);
    const user = userEvent.setup();
    const win = shellWindow();
    const hamburger = screen.getByRole('button', { name: 'Navigation' });
    await user.click(hamburger);
    act(() => screen.getByRole('button', { name: 'Copy code' }).focus());
    expect(win.hasAttribute('data-nav-open')).toBe(false);

    await user.click(hamburger);
    const backdrop = document.querySelector<HTMLElement>('[data-shell-backdrop]')!;
    expect(backdrop.getAttribute('aria-hidden')).toBe('true');
    await user.click(backdrop);
    expect(win.hasAttribute('data-nav-open')).toBe(false);
    expect(document.querySelector('[data-shell-backdrop]')).toBeNull();
  });
});

describe('window state script', () => {
  function runIn(win: HTMLElement) {
    const script = document.createElement('script');
    win.prepend(script);
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script);
    try {
      (0, eval)(WINDOW_INIT_SCRIPT);
    } finally {
      vi.restoreAllMocks();
    }
  }

  it('restores a maximized window before first paint', () => {
    const win = document.body.appendChild(document.createElement('div'));
    localStorage.setItem(MAXIMIZED_KEY, '1');
    runIn(win);
    expect(win.hasAttribute('data-maximized')).toBe(true);
  });

  it('leaves the window centered otherwise, and survives blocked storage', () => {
    const win = document.body.appendChild(document.createElement('div'));
    localStorage.setItem(MAXIMIZED_KEY, '0');
    runIn(win);
    expect(win.hasAttribute('data-maximized')).toBe(false);
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked');
      },
    });
    expect(() => runIn(win)).not.toThrow();
    expect(win.hasAttribute('data-maximized')).toBe(false);
  });

  it('is small and import-free', () => {
    expect(new TextEncoder().encode(WINDOW_INIT_SCRIPT).length).toBeLessThan(200);
    expect(WINDOW_INIT_SCRIPT).toContain(MAXIMIZED_KEY);
  });
});

describe('urls', () => {
  it('the base is the one astro.config.mjs builds with', () => {
    expect(astroConfig.base).toBe(DOCS_BASE);
    expect(DOCS_BASE).toBe('/waveui/docs');
    expect(componentHref('data-grid')).toBe('/waveui/docs/components/data-grid');
  });
});
