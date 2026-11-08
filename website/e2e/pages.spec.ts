/**
 * Every page of the build, in a real browser:
 *
 * - at desktop width, after load and idle and again after every example has been scrolled into
 *   view and hydrated: nothing traps the visitor (a story that opens a modal on mount would; Task 9
 *   mounts those only on a click). Focus is on the body or the skip link's target, no dialog is
 *   shown, `<html>` and `<body>` carry no scroll lock, nothing shown outside an example (and
 *   nothing around the shell) is `inert`, and nothing hides the navigation or the content from
 *   assistive technology;
 * - at phone width, at load and with every example hydrated: no horizontal scroll.
 *
 * One test per page, so a failure names the page.
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, hydrateAllIslands, sitePages, waitForShell } from './site';

const PAGES = sitePages();

/** Waits for the shell island and then for an idle period of the page's main thread. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await waitForShell(page);
  await page.waitForLoadState('networkidle');
  await page.evaluate(
    () =>
      new Promise((done) =>
        'requestIdleCallback' in window
          ? requestIdleCallback(() => done(undefined), { timeout: 2_000 })
          : setTimeout(done, 200),
      ),
  );
}

/** What traps the visitor on the page now, each problem in words. */
function trapProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const describe = (element: Element) => {
      const name = element.getAttribute('aria-label') ?? element.textContent ?? '';
      return `<${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}> "${name.trim().slice(0, 40)}"`;
    };
    const problems: string[] = [];
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.getElementById('main')) {
      problems.push(`focus is on ${describe(active)}`);
    }
    for (const dialog of document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]',
    )) {
      if (dialog.checkVisibility()) problems.push(`a dialog is shown: ${describe(dialog)}`);
    }
    for (const element of [document.documentElement, document.body]) {
      const inline = element.getAttribute('style')?.trim();
      if (inline)
        problems.push(`<${element.tagName.toLowerCase()}> has an inline style: ${inline}`);
      const { overflowX, overflowY } = getComputedStyle(element);
      if ([overflowX, overflowY].some((value) => value === 'hidden' || value === 'clip')) {
        problems.push(`<${element.tagName.toLowerCase()}> has overflow ${overflowX} ${overflowY}`);
      }
    }
    // Inside an example, a component may make its own hidden parts inert (a carousel's other
    // slides, a breadcrumb's collapsed items), and a closed surface it keeps mounted in a portal
    // is inert and not shown. Anything else inert, shown or holding the shell, is a modal's
    // isolation of the page.
    const example = 'astro-island:not([component-url*="ShellControls"])';
    const shell = ['shell-window', 'components-nav', 'main'].map((id) =>
      document.getElementById(id),
    );
    for (const element of document.querySelectorAll('[inert]')) {
      if (element.closest(example)) continue;
      const holdsShell = shell.some((part) => part && element.contains(part));
      if (holdsShell || element.checkVisibility()) {
        problems.push(`${describe(element)} is inert${holdsShell ? ' and holds the shell' : ''}`);
      }
    }
    for (const id of ['components-nav', 'main']) {
      const hidden = document.getElementById(id)?.closest('[aria-hidden="true"]');
      if (hidden) problems.push(`#${id} is inside aria-hidden ${describe(hidden)}`);
    }
    return problems;
  });
}

/** The page's horizontal overflow at the viewport's width, with the widest elements named. */
function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const width = root.clientWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && (box.right > width + 0.5 || box.left < -0.5);
      })
      .slice(0, 5)
      .map(
        (element) =>
          `<${element.tagName.toLowerCase()} class="${(element.getAttribute('class') ?? '').slice(0, 60)}">`,
      );
    return { scrollWidth: root.scrollWidth, clientWidth: width, offenders };
  });
}

test('the trap check sees a modal dialog a visitor opens, and its end', async ({ page }) => {
  await page.goto('/waveui/docs/components/dialog');
  await settle(page);
  await hydrateAllIslands(page);
  const example = page.getByRole('group', { name: 'Example: Default' });
  await example.getByRole('button', { name: 'Open dialog' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const problems = await trapProblems(page);
  expect(problems.some((problem) => problem.startsWith('focus is on'))).toBe(true);
  expect(problems.some((problem) => problem.startsWith('a dialog is shown'))).toBe(true);
  expect(problems.some((problem) => /inert|aria-hidden|inline style|overflow/.test(problem))).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect.poll(() => trapProblems(page)).toEqual([]);
});

test.describe('desktop: no focus trap, dialog, scroll lock or inert after load', () => {
  for (const sitePage of PAGES) {
    test(`no trap: ${sitePage.name}`, async ({ page }) => {
      await page.goto(sitePage.path);
      await settle(page);
      expect(await trapProblems(page), `${sitePage.name} after load and idle`).toEqual([]);
      await hydrateAllIslands(page);
      await settle(page);
      expect(await trapProblems(page), `${sitePage.name} with every example hydrated`).toEqual([]);
    });
  }
});

test.describe('phone: no horizontal scroll', () => {
  test.use(PHONE);
  for (const sitePage of PAGES) {
    test(`no horizontal scroll: ${sitePage.name}`, async ({ page }) => {
      await page.goto(sitePage.path);
      await settle(page);
      const atLoad = await horizontalOverflow(page);
      expect(
        atLoad.scrollWidth,
        `${sitePage.name} at load: ${atLoad.offenders.join(', ')}`,
      ).toBeLessThanOrEqual(atLoad.clientWidth);
      await hydrateAllIslands(page);
      const hydrated = await horizontalOverflow(page);
      expect(
        hydrated.scrollWidth,
        `${sitePage.name} with every example hydrated: ${hydrated.offenders.join(', ')}`,
      ).toBeLessThanOrEqual(hydrated.clientWidth);
    });
  }
});
