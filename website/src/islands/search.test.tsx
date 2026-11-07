/**
 * The search palette, as a reader gets it: the app shell is rendered by Astro's container API,
 * its island (`ShellControls`) is hydrated on the server markup, and the palette arrives through
 * the island's lazy chunk on the first Ctrl+K, Cmd+K or Search. The index is the site's real one
 * (`readSearchIndex`), served by a stubbed `fetch`.
 *
 * Runs in the `shell` Vitest project (vitest.config.ts): jsdom globals with the SSR transform.
 */
import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { hydrateRoot, type Root } from 'react-dom/client';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dialogContentClassNames } from '../../../src/lib/classNames';
import AppLayout from '../layouts/AppLayout.astro';
import { readSearchIndex } from '../search/searchIndex';
import { SEARCH_INDEX_URL } from '../shell/urls';
import ShellControls, { searchPaletteChunk } from './ShellControls';
import { paletteNavigation } from './SearchPalette';

const CONTENT =
  '<h1>Button</h1><p>Buttons start an action.</p><label>Name <input id="name-field" type="text"></label>';

let container: AstroContainer;
let root: Root | undefined;
const index = readSearchIndex();

beforeAll(async () => {
  container = await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
  });
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

/** A `fetch` that serves the index, counted. */
function serveIndex(response: () => Promise<unknown> = async () => index) {
  const fetchSpy = vi.fn(async (url: string) => {
    expect(url).toBe(SEARCH_INDEX_URL);
    return { ok: true, status: 200, json: response };
  });
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

/** The shell with the island hydrated on its server markup, as Astro's renderer does on idle. */
async function mount(): Promise<void> {
  const html = await container.renderToString(AppLayout, {
    props: { title: 'Button', current: 'button' },
    slots: { default: CONTENT },
  });
  const page = new DOMParser().parseFromString(html, 'text/html');
  for (const { name, value } of page.documentElement.attributes) {
    document.documentElement.setAttribute(name, value);
  }
  for (const { name, value } of page.body.attributes) document.body.setAttribute(name, value);
  document.head.innerHTML = page.head.innerHTML;
  document.body.innerHTML = page.body.innerHTML;
  const island = document.querySelector('astro-island')!;
  for (const node of [...island.childNodes]) {
    if (node.nodeType === Node.COMMENT_NODE && node.nodeValue === 'astro:end') node.remove();
  }
  const errors: unknown[] = [];
  await act(async () => {
    root = hydrateRoot(island, <ShellControls />, {
      identifierPrefix: island.getAttribute('prefix') ?? undefined,
      onRecoverableError: (error) => errors.push(error),
    });
  });
  expect(errors).toEqual([]);
}

const findPalette = () => screen.findByRole('dialog', { name: 'Search' });
const input = () => screen.getByRole('combobox', { name: 'Search the docs' });
const options = () =>
  within(screen.getByRole('listbox', { name: 'Results' })).getAllByRole('option');
const activeOption = () => {
  const id = input().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
};

/** Focus `element`, then press the shortcut. */
async function pressShortcut(
  user: ReturnType<typeof userEvent.setup>,
  modifier: 'Control' | 'Meta' = 'Control',
) {
  await user.keyboard(`{${modifier}>}k{/${modifier}}`);
}

async function openWithResults(query: string) {
  const user = userEvent.setup();
  serveIndex();
  await mount();
  const link = screen.getByRole('link', { name: 'Theming' });
  act(() => link.focus());
  await pressShortcut(user);
  await findPalette();
  await waitFor(() => expect(document.activeElement).toBe(input()));
  await user.keyboard(query);
  await waitFor(() => expect(options().length).toBeGreaterThan(0));
  return { user, link };
}

describe('the search palette', () => {
  it('Ctrl+K opens the palette and focuses its input', async () => {
    const user = userEvent.setup();
    serveIndex();
    await mount();
    expect(screen.queryByRole('dialog')).toBeNull();
    await pressShortcut(user);
    const dialog = await findPalette();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    expect(dialog.contains(input())).toBe(true);
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().getAttribute('aria-autocomplete')).toBe('list');
  });

  it('Cmd+K opens it as well', async () => {
    const user = userEvent.setup();
    serveIndex();
    await mount();
    await pressShortcut(user, 'Meta');
    await findPalette();
    await waitFor(() => expect(document.activeElement).toBe(input()));
  });

  it('the shortcut opens it from a text field too, and is the browser’s again while it is open', async () => {
    serveIndex();
    await mount();
    const field = document.getElementById('name-field')!;
    act(() => field.focus());
    const press = (target: Element) => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        target.dispatchEvent(event);
      });
      return event;
    };
    // Opening it takes the key from the browser.
    expect(press(field).defaultPrevented).toBe(true);
    await findPalette();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    // While it is open the shortcut opens nothing, so it is left to the browser.
    expect(press(input()).defaultPrevented).toBe(false);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    // Other chords are never taken.
    const shifted = new KeyboardEvent('keydown', {
      key: 'K',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      document.body.dispatchEvent(shifted);
    });
    expect(shifted.defaultPrevented).toBe(false);
  });

  it('the Search command opens it', async () => {
    const user = userEvent.setup();
    serveIndex();
    await mount();
    const search = screen.getByRole('button', { name: 'Search' });
    expect(search.getAttribute('aria-keyshortcuts')).toBe('Control+K Meta+K');
    await user.click(search);
    await findPalette();
    await waitFor(() => expect(document.activeElement).toBe(input()));
  });

  it('typing "dat" lists DataGrid and DatePicker first', async () => {
    await openWithResults('dat');
    const names = options().map((option) => option.textContent);
    expect(names[0]).toMatch(/^DataGrid\b/);
    expect(names[1]).toMatch(/^DatePicker\b/);
    expect(options()[0]!.getAttribute('href')).toBe('/waveui/docs/components/data-grid');
    expect(options().length).toBeLessThanOrEqual(10);
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('a prop name finds its component', async () => {
    await openWithResults('selectedItems');
    const hit = options().find((option) =>
      option.textContent?.startsWith('DataGrid.selectedItems'),
    );
    expect(hit).toBeDefined();
    expect(hit!.getAttribute('href')).toBe('/waveui/docs/components/data-grid#props');
  });

  it('ArrowDown and ArrowUp move the active result, which aria-activedescendant names', async () => {
    const { user } = await openWithResults('dat');
    const all = options();
    expect(activeOption()).toBe(all[0]);
    expect(all[0]!.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(all[1]);
    expect(all[1]!.getAttribute('aria-selected')).toBe('true');
    expect(all[0]!.getAttribute('aria-selected')).toBe('false');
    await user.keyboard('{ArrowUp}');
    expect(activeOption()).toBe(all[0]);
    // It wraps around both ends.
    await user.keyboard('{ArrowUp}');
    expect(activeOption()).toBe(all.at(-1));
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(all[0]);
    // Focus never leaves the input.
    expect(document.activeElement).toBe(input());
  });

  it('Enter follows the result', async () => {
    const go = vi.spyOn(paletteNavigation, 'go').mockImplementation(() => {});
    const { user } = await openWithResults('dat');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(go).toHaveBeenCalledExactlyOnceWith('/waveui/docs/components/date-picker');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Escape closes and returns focus', async () => {
    const { user, link } = await openWithResults('dat');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(link);
  });

  it('a click outside closes it and returns focus', async () => {
    const { user, link } = await openWithResults('dat');
    const backdrop = document.querySelector<HTMLElement>(`.${dialogContentClassNames.backdrop}`)!;
    expect(backdrop).not.toBeNull();
    await user.click(backdrop);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(link);
  });

  it('clicking a result follows its link and closes the palette', async () => {
    const { user, link } = await openWithResults('dat');
    const target = options()[0]!;
    let followed: string | null = null;
    const onClick = (event: MouseEvent) => {
      followed = (event.target as Element).closest('a')?.getAttribute('href') ?? null;
      // jsdom cannot navigate: the default action is the browser's.
      event.preventDefault();
    };
    document.addEventListener('click', onClick);
    try {
      await user.click(target);
    } finally {
      document.removeEventListener('click', onClick);
    }
    expect(followed).toBe('/waveui/docs/components/data-grid');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(link);
  });

  it('the index is not requested before the palette opens', async () => {
    const fetchSpy = serveIndex();
    const load = vi.spyOn(searchPaletteChunk, 'load');
    const user = userEvent.setup();
    await mount();
    await act(async () => {});
    expect(load).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    await pressShortcut(user);
    await findPalette();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());
    expect(load).toHaveBeenCalledOnce();
    // Opening it again needs neither again.
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await pressShortcut(user);
    await findPalette();
    expect(load).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('says when the index cannot be loaded, and tries again on the next opening', async () => {
    let fail = true;
    const fetchSpy = serveIndex(async () => {
      if (fail) throw new Error('offline');
      return index;
    });
    const user = userEvent.setup();
    await mount();
    await pressShortcut(user);
    await findPalette();
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'Search is unavailable. Try again later.',
      ),
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fail = false;
    await pressShortcut(user);
    await findPalette();
    await user.keyboard('dat');
    await waitFor(() => expect(options().length).toBeGreaterThan(0));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('announces the results', async () => {
    const { user } = await openWithResults('dat');
    expect(screen.getByRole('status').textContent).toMatch(/^\d+ results?$/);
    await user.clear(input());
    await user.keyboard('zzzq');
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('No results for “zzzq”'),
    );
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('follows the theme and direction of the page, and its motion stops under reduced motion', async () => {
    const user = userEvent.setup();
    serveIndex();
    await mount();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'dark');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Direction' }), 'rtl');
    await pressShortcut(user);
    const dialog = await findPalette();
    const portal = dialog.closest('.wave-portal')!;
    expect(portal.classList.contains('wave-dark')).toBe(true);
    expect(portal.getAttribute('dir')).toBe('rtl');
    // The library's dialog motion, which motion-reduce turns off.
    expect(dialog.className).toMatch(/(^|\s)wave:motion-reduce:transition-none(\s|$)/);
  });

  it('axe finds no violations in the open palette', async () => {
    await openWithResults('dat');
    const results = await axe.run(document, {
      // jsdom cannot compute contrast (src/test-utils.ts); the token tests guard it per theme.
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`),
    ).toEqual([]);
    expect(results.passes.length).toBeGreaterThan(20);
  });
});
