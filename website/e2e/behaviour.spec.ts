/**
 * The site's behaviour in a real browser (Task 13 of the plan; the names of the first eight tests
 * are the plan's): scripts off, the theme before first paint, blocked storage, right to left, the
 * keyboard, phone width, the trailing-slash rule, reduced motion; then the navigation without the
 * shell island, the drawer's backdrop, and console errors during load and hydration.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DOCS, PHONE, hydrateAllIslands, waitForShell } from './site';

const BUTTON = `${DOCS}/components/button`;

/** Every `console.error` and uncaught error of `page` from now on. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page error: ${error.message}`));
  return errors;
}

/** Presses Tab, at most `presses` times, until `target` has focus; fails naming what has it. */
async function tabUntilFocused(page: Page, target: Locator, presses: number): Promise<void> {
  const handle = await target.elementHandle({ timeout: 5_000 }).catch(() => null);
  for (let step = 0; step < presses; step += 1) {
    if (handle && (await handle.evaluate((element) => element === document.activeElement))) return;
    await page.keyboard.press('Tab');
  }
  const focused = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    return `${element?.tagName} "${(element?.getAttribute('aria-label') ?? element?.textContent ?? '').trim().slice(0, 40)}"`;
  });
  expect(
    handle && (await handle.evaluate((element) => element === document.activeElement)),
    `${target} after ${presses} presses of Tab; focus is on ${focused}`,
  ).toBe(true);
}

/** The `wave-*` theme classes of `<html>`. */
const themeClasses = (page: Page) =>
  page.evaluate(() =>
    [...document.documentElement.classList].filter((name) =>
      /^wave-(light|dark|high-contrast)$/.test(name),
    ),
  );

test.describe('with JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('with JavaScript disabled the button page shows nav, description, props and code', async ({
    page,
  }) => {
    await page.goto(BUTTON);
    const nav = page.getByRole('navigation', { name: 'Components' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Button', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
    await expect(page.locator('[data-description]')).toContainText(
      'A button with Fluent appearances and sizes.',
    );
    await expect(page.getByRole('table', { name: 'Props of Button' })).toBeVisible();
    await expect(page.locator('main pre').first()).toContainText('export const Default');
    // The first example's static preview: its default args, rendered on the server.
    await expect(
      page.locator('main').getByRole('button', { name: 'Button', exact: true }).first(),
    ).toBeVisible();
    // The command bar needs script, so it is not shown.
    await expect(page.getByRole('group', { name: 'Page commands' })).toBeHidden();
  });

  test('at phone width with scripts off the navigation is in the page, above the content', async ({
    browser,
  }) => {
    const context = await browser.newContext({ ...PHONE, javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.goto(BUTTON);
      const nav = page.getByRole('navigation', { name: 'Components' });
      await expect(nav).toBeVisible();
      const navBox = (await nav.boundingBox())!;
      const mainBox = (await page.locator('main').boundingBox())!;
      expect(navBox.y + navBox.height).toBeLessThanOrEqual(mainBox.y + 1);
    } finally {
      await context.close();
    }
  });
});

test('theme switch persists across a reload and sets no flash', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  // What `<html>` carries when `<body>` is first inserted, before anything of the page can paint.
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (!document.body) return;
      (window as unknown as { classAtBody: string }).classAtBody =
        document.documentElement.className;
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.goto(BUTTON);
  await waitForShell(page);
  expect(await themeClasses(page)).toEqual(['wave-light']);
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark');
  expect(await themeClasses(page)).toEqual(['wave-dark']);

  // On the reload the shell island waits until the class has been checked, so whatever `<html>`
  // carries at `domcontentloaded` came from the inline head script.
  let release = () => {};
  const held = new Promise<void>((done) => (release = done));
  await page.route('**/_assets/ShellControls.*.js', async (route) => {
    await held;
    await route.continue();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(
    await page.evaluate(() => (window as unknown as { classAtBody: string }).classAtBody),
  ).toMatch(/(^| )wave-dark( |$)/);
  expect(await themeClasses(page)).toEqual(['wave-dark']);
  await expect(page.getByRole('button', { name: 'Search' })).toBeDisabled();
  release();
  await waitForShell(page);
  await expect(page.getByRole('combobox', { name: 'Theme' })).toHaveValue('dark');
  expect(await themeClasses(page)).toEqual(['wave-dark']);
});

test('blocked localStorage still renders and switches theme for the session', async ({ page }) => {
  const errors = collectErrors(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    const blocked = {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    };
    Object.defineProperty(Window.prototype, 'localStorage', blocked);
    Object.defineProperty(window, 'localStorage', blocked);
  });
  await page.goto(BUTTON);
  expect(
    await page.evaluate(() => {
      try {
        return typeof window.localStorage;
      } catch {
        return 'blocked';
      }
    }),
  ).toBe('blocked');
  await expect(page.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
  await waitForShell(page);

  await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark');
  expect(await themeClasses(page)).toEqual(['wave-dark']);
  await page.getByRole('combobox', { name: 'Direction' }).selectOption('rtl');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'Maximize' }).click();
  await expect(page.locator('#shell-window')).toHaveAttribute('data-maximized', '');

  // Nothing could be stored: the next page starts from the system setting again.
  await page
    .getByRole('navigation', { name: 'Components' })
    .getByRole('link', { name: 'Dialog', exact: true })
    .click();
  await expect(page).toHaveURL(`${DOCS}/components/dialog`);
  expect(await themeClasses(page)).toEqual(['wave-light']);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  expect(errors).toEqual([]);
});

test('right to left mirrors the window controls and nav side', async ({ page }) => {
  await page.goto(BUTTON);
  await waitForShell(page);
  const measure = async () => {
    const box = async (selector: ReturnType<Page['locator']>) => (await selector.boundingBox())!;
    return {
      window: await box(page.locator('#shell-window')),
      title: await box(page.locator('[data-shell-title]')),
      maximize: await box(page.getByRole('button', { name: 'Maximize' })),
      close: await box(page.getByRole('link', { name: 'Close' })),
      nav: await box(page.getByRole('navigation', { name: 'Components' })),
      main: await box(page.locator('main')),
    };
  };
  const ltr = await measure();
  await page.getByRole('combobox', { name: 'Direction' }).selectOption('rtl');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const rtl = await measure();

  // Left to right: the controls at the right end, Close last; the navigation on the left.
  expect(ltr.close.x).toBeGreaterThan(ltr.title.x);
  expect(ltr.maximize.x).toBeLessThan(ltr.close.x);
  expect(ltr.nav.x).toBeLessThan(ltr.main.x);
  // Right to left: all of it mirrored.
  expect(rtl.close.x).toBeLessThan(rtl.title.x);
  expect(rtl.maximize.x).toBeGreaterThan(rtl.close.x);
  expect(rtl.nav.x).toBeGreaterThan(rtl.main.x);
  const fromRight = (box: { x: number; width: number }, frame: { x: number; width: number }) =>
    frame.x + frame.width - (box.x + box.width);
  const fromLeft = (box: { x: number }, frame: { x: number }) => box.x - frame.x;
  expect(
    Math.abs(fromRight(ltr.close, ltr.window) - fromLeft(rtl.close, rtl.window)),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(fromRight(ltr.maximize, ltr.window) - fromLeft(rtl.maximize, rtl.window)),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(fromLeft(ltr.nav, ltr.window) - fromRight(rtl.nav, rtl.window)),
  ).toBeLessThanOrEqual(1);
});

test('keyboard: skip link, nav, Ctrl+K, Escape', async ({ page }) => {
  await page.goto(BUTTON);
  await waitForShell(page);
  const focused = () =>
    page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return {
        id: element?.id ?? '',
        name: (element?.getAttribute('aria-label') ?? element?.textContent ?? '').trim(),
        inNav: Boolean(element?.closest('#components-nav')),
      };
    });

  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  expect((await focused()).id).toBe('main');

  // From the top: the skip link, the window controls, then the navigation's links in order.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.goto(BUTTON);
  await waitForShell(page);
  const order: string[] = [];
  for (let step = 0; step < 5; step += 1) {
    await page.keyboard.press('Tab');
    const { name, inNav } = await focused();
    order.push(inNav ? `nav:${name}` : name);
  }
  expect(order).toEqual([
    'Skip to content',
    'Maximize',
    'Close',
    'nav:Getting started',
    'nav:Theming',
  ]);
  const button = page
    .getByRole('navigation', { name: 'Components' })
    .getByRole('link', { name: 'Button', exact: true });
  await button.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();

  // Ctrl+K opens the palette with focus in its field; Escape closes it and focus goes back.
  await page.keyboard.press('Control+K');
  const palette = page.getByRole('dialog');
  await expect(palette).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Search the docs' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
  await expect(button).toBeFocused();
});

test.describe('phone width', () => {
  test.use(PHONE);

  test('phone width: nav is a drawer, no horizontal scroll', async ({ page }) => {
    await page.goto(BUTTON);
    await waitForShell(page);
    const nav = page.getByRole('navigation', { name: 'Components' });
    const hamburger = page.getByRole('button', { name: 'Navigation' });
    await expect(nav).toBeHidden();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');

    await hamburger.click();
    await expect(nav).toBeVisible();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    expect(await nav.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
    await expect(nav.getByRole('link', { name: 'Button', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(hamburger).toBeFocused();

    await hydrateAllIslands(page);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test('a click on the drawer backdrop closes it and returns focus to the hamburger', async ({
    page,
  }) => {
    await page.goto(BUTTON);
    await waitForShell(page);
    const nav = page.getByRole('navigation', { name: 'Components' });
    const hamburger = page.getByRole('button', { name: 'Navigation' });
    await hamburger.click();
    await expect(nav).toBeVisible();
    // The backdrop covers the page beside the drawer (which starts at the inline start).
    await page.mouse.click(380, 600);
    await expect(nav).toBeHidden();
    await expect(hamburger).toBeFocused();
  });

  test('without the shell island the navigation is still reached by keyboard', async ({ page }) => {
    const shell = await page.request.get(BUTTON).then((response) => response.text());
    const islandUrl = /component-url="([^"]*ShellControls[^"]*)"/.exec(shell)?.[1];
    expect(islandUrl).toBeTruthy();
    // By its path: Astro's island runtime retries a failed import once, a second later, with an
    // `astro-retry` query. The disabled Search command below is the proof that the island never
    // ran.
    let blocked = 0;
    await page.route(
      (url) => url.pathname === islandUrl,
      (route) => {
        blocked += 1;
        return route.abort();
      },
    );
    await page.goto(BUTTON);
    await expect.poll(() => blocked).toBeGreaterThanOrEqual(1);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Search' })).toBeDisabled();

    const nav = page.getByRole('navigation', { name: 'Components' });
    await expect(nav).toBeHidden();
    const link = page.getByRole('link', { name: 'Navigation', exact: true });
    await tabUntilFocused(page, link, 6);
    await expect(link).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(nav).toBeVisible();
    // The next Tab goes into the navigation; a few more reach the first link to another component.
    const target = nav.locator(`a[href^="${DOCS}/components/"]:not([aria-current])`).first();
    const href = await target.getAttribute('href');
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('link', { name: 'Getting started' })).toBeFocused();
    await tabUntilFocused(page, target, 10);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(href!);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('once the island has hydrated, an address that targets the navigation leaves it to the drawer', async ({
    page,
  }) => {
    // The fallback's `:target` rule applies only before hydration: a shared #components-nav link
    // (or a fallback link used before the island ran) must not leave the pane in the page next to
    // the working drawer.
    await page.goto(`${BUTTON}#components-nav`);
    await waitForShell(page);
    const nav = page.getByRole('navigation', { name: 'Components' });
    await expect(nav).toBeHidden();
    await page.getByRole('button', { name: 'Navigation' }).click();
    await expect(nav).toBeVisible();
    expect(await nav.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
  });
});

test('a page loads from a nested path with a trailing slash redirect or 404 consistently', async ({
  page,
}) => {
  // The rule (e2e/server.spec.ts says where it comes from): through the homepage, an address that
  // ends in `/` gets a 308 to the address without it, for a page, a nested page and the app's
  // root alike, and that address loads.
  const slashed: [string, string][] = [
    [`${BUTTON}/`, BUTTON],
    [`${DOCS}/components/`, `${DOCS}/components`],
    [`${DOCS}/`, DOCS],
  ];
  for (const [from, to] of slashed) {
    const response = await page.goto(from);
    expect(response?.status(), from).toBe(200);
    expect(new URL(page.url()).pathname, from).toBe(to);
    const redirect = await response?.request().redirectedFrom()?.response();
    expect(redirect?.status(), from).toBe(308);
    await expect(page.locator('h1')).toBeVisible();
  }
  await page.goto(BUTTON);
  await expect(page.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
});

test.describe('reduced motion', () => {
  /** Records, on every page, whether the browser revealed it with a cross-document view transition. */
  async function recordViewTransition(page: Page) {
    await page.addInitScript(() => {
      window.addEventListener('pagereveal', (event) => {
        (window as unknown as { revealedWithTransition: boolean }).revealedWithTransition = Boolean(
          (event as Event & { viewTransition?: unknown }).viewTransition,
        );
      });
    });
  }

  async function navigateWithinTheApp(page: Page) {
    await page.goto(BUTTON);
    await waitForShell(page);
    await page
      .getByRole('navigation', { name: 'Components' })
      .getByRole('link', { name: 'Dialog', exact: true })
      .click();
    await expect(page).toHaveURL(`${DOCS}/components/dialog`);
    await page.waitForLoadState('load');
    return page.evaluate(
      () => (window as unknown as { revealedWithTransition?: boolean }).revealedWithTransition,
    );
  }

  test('without the preference, a navigation in the app is a view transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await recordViewTransition(page);
    expect(await navigateWithinTheApp(page)).toBe(true);
    expect(
      await page
        .locator('#shell-window')
        .evaluate((element) => getComputedStyle(element).viewTransitionName),
    ).toBe('waveui-window');
  });

  test('reduced motion removes the maximize transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await recordViewTransition(page);
    expect(await navigateWithinTheApp(page)).toBe(false);
    const win = page.locator('#shell-window');
    expect(await win.evaluate((element) => getComputedStyle(element).viewTransitionName)).toBe(
      'none',
    );

    // Maximize and restore change the window at once: nothing of the window or its controls
    // animates or transitions.
    const maximize = page.getByRole('button', { name: 'Maximize' });
    const transitioning = await page.evaluate(() =>
      [...document.querySelectorAll('#shell-window, #shell-window header *')]
        .filter((element) => {
          const style = getComputedStyle(element);
          const longest = Math.max(...style.transitionDuration.split(',').map(parseFloat));
          return style.transitionProperty !== 'none' && longest > 0;
        })
        .map((element) => element.outerHTML.slice(0, 80)),
    );
    expect(transitioning).toEqual([]);
    await maximize.hover();
    await maximize.click();
    await expect(win).toHaveAttribute('data-maximized', '');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(win).not.toHaveAttribute('data-maximized', '');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

test.describe('no console errors during load and hydration', () => {
  const SAMPLES = [
    'components/button',
    'components/dialog',
    'components/data-grid',
    'components/menu',
    'components/teaching-popover',
    'components/avatar',
    'index',
    'getting-started',
  ];
  for (const name of SAMPLES) {
    test(`no console errors: ${name}`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(name === 'index' ? DOCS : `${DOCS}/${name}`);
      await waitForShell(page);
      await hydrateAllIslands(page);
      await page.waitForLoadState('networkidle');
      expect(errors, name).toEqual([]);
    });
  }
});
