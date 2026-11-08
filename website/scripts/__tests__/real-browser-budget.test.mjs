/**
 * The real-browser budget's rules (`scripts/real-browser-budget.mjs`): which measured pages pass,
 * which fail, and what `budget-real-browser.json` may hold. The measuring itself runs in
 * Playwright (`e2e/budget.spec.ts`).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUDGET_MARGIN } from '../check-budget.mjs';
import {
  checkRealBrowserBudget,
  readRealBrowserExceptions,
  REAL_BROWSER_LIMIT,
  VIEWPORTS,
} from '../real-browser-budget.mjs';

const row = (page, viewport, firstLoadGzip) => ({ page, viewport, firstLoadGzip });
const entry = (page, viewport, firstLoadGzip, reason = 'its stories load the popup stack') => ({
  page,
  viewport,
  firstLoadGzip,
  reason,
});

describe('checkRealBrowserBudget', () => {
  it('passes pages at or under the limit, at both viewports', () => {
    const result = checkRealBrowserBudget(
      [
        row('components/button', 'desktop', 120_000),
        row('components/button', 'phone', REAL_BROWSER_LIMIT),
      ],
      [],
    );
    expect(result.problems).toEqual([]);
    expect(result.excepted).toEqual([]);
  });

  it('fails a page over the limit that is not listed, naming the page, the viewport and the bytes', () => {
    const { problems } = checkRealBrowserBudget(
      [row('components/data-grid', 'phone', 151_234)],
      [],
    );
    expect(problems).toEqual([
      'components/data-grid @ phone: 151,234 B of first-load JavaScript in a real browser, above the 150,000 B limit; bring it down, or record it in budget-real-browser.json with its reason',
    ]);
  });

  it('uses the margin of the static gate', () => {
    expect(BUDGET_MARGIN).toBe(1_024);
  });

  it('passes a listed page under its recorded number, with its headroom against recorded + margin', () => {
    const result = checkRealBrowserBudget(
      [row('components/data-grid', 'desktop', 160_000)],
      [entry('components/data-grid', 'desktop', 160_500)],
    );
    expect(result.problems).toEqual([]);
    expect(result.excepted).toEqual([
      {
        page: 'components/data-grid',
        viewport: 'desktop',
        recorded: 160_500,
        ceiling: 161_524,
        measured: 160_000,
        headroom: 1_524,
        reason: 'its stories load the popup stack',
      },
    ]);
  });

  it('passes a listed page that measures exactly its recorded number, and one at recorded + margin', () => {
    const result = checkRealBrowserBudget(
      [
        row('components/breadcrumb', 'phone', 156_147),
        row('components/breadcrumb', 'desktop', 156_147 + 1_024),
      ],
      [
        entry('components/breadcrumb', 'phone', 156_147),
        entry('components/breadcrumb', 'desktop', 156_147),
      ],
    );
    expect(result.problems).toEqual([]);
    expect(result.excepted).toEqual([
      {
        page: 'components/breadcrumb',
        viewport: 'phone',
        recorded: 156_147,
        ceiling: 157_171,
        measured: 156_147,
        headroom: 1_024,
        reason: 'its stories load the popup stack',
      },
      {
        page: 'components/breadcrumb',
        viewport: 'desktop',
        recorded: 156_147,
        ceiling: 157_171,
        measured: 157_171,
        headroom: 0,
        reason: 'its stories load the popup stack',
      },
    ]);
  });

  it('fails a listed page above its recorded number plus the margin (a regression)', () => {
    const { problems } = checkRealBrowserBudget(
      [row('components/data-grid', 'desktop', 161_025)],
      [entry('components/data-grid', 'desktop', 160_000)],
    );
    expect(problems).toEqual([
      'components/data-grid @ desktop: 161,025 B of first-load JavaScript in a real browser, above its recorded 160,000 B plus the 1,024 B margin in budget-real-browser.json (a regression: bring it down, or re-record it deliberately with its reason)',
    ]);
  });

  it('fails a stale entry: the page is under the limit now', () => {
    const { problems } = checkRealBrowserBudget(
      [row('components/drawer', 'phone', 149_000)],
      [entry('components/drawer', 'phone', 151_000)],
    );
    expect(problems).toEqual([
      'budget-real-browser.json lists components/drawer @ phone at 151,000 B, but it measures 149,000 B, under the limit: remove the entry',
    ]);
  });

  it('fails an entry for a page the run measured at its viewport but did not find', () => {
    const { problems } = checkRealBrowserBudget(
      [row('components/button', 'desktop', 100_000)],
      [entry('components/gone', 'desktop', 160_000)],
    );
    expect(problems).toEqual([
      'budget-real-browser.json lists components/gone @ desktop, but the build has no such page',
    ]);
  });

  it('leaves alone an entry of a viewport this run did not measure', () => {
    const { problems } = checkRealBrowserBudget(
      [row('components/button', 'desktop', 100_000)],
      [entry('components/data-grid', 'phone', 160_000)],
    );
    expect(problems).toEqual([]);
  });

  it('fails malformed and duplicate entries', () => {
    const { problems } = checkRealBrowserBudget(
      [row('components/data-grid', 'desktop', 160_000)],
      [
        entry('components/data-grid', 'desktop', 160_000),
        entry('components/data-grid', 'desktop', 160_000),
        { page: 'components/nav', viewport: 'tablet', firstLoadGzip: 1, reason: 'x' },
        { page: 'components/nav', viewport: 'phone', firstLoadGzip: 0, reason: 'x' },
        { page: 'components/nav', viewport: 'desktop', firstLoadGzip: 155_000, reason: ' ' },
        { viewport: 'desktop', firstLoadGzip: 155_000, reason: 'x' },
      ],
    );
    expect(problems).toEqual([
      'budget-real-browser.json lists components/data-grid @ desktop twice',
      `budget-real-browser.json: components/nav has the viewport "tablet"; use ${Object.keys(VIEWPORTS).join(' or ')}`,
      'budget-real-browser.json: components/nav @ phone needs a firstLoadGzip, the measured bytes (a positive integer)',
      'budget-real-browser.json: components/nav @ desktop needs a reason, the documented decision',
      'budget-real-browser.json: an entry has no page',
    ]);
  });
});

describe('readRealBrowserExceptions', () => {
  let directory;
  afterEach(() => {
    if (directory) rmSync(directory, { recursive: true, force: true });
    directory = undefined;
  });
  const write = (text) => {
    directory = mkdtempSync(join(tmpdir(), 'waveui-real-budget-'));
    const file = join(directory, 'budget-real-browser.json');
    writeFileSync(file, text);
    return file;
  };

  it('reads the entries of the file', () => {
    const entries = [entry('components/data-grid', 'phone', 160_000)];
    expect(readRealBrowserExceptions(write(JSON.stringify(entries)))).toEqual(entries);
  });

  it('throws, naming the file, for invalid JSON or a value that is not an array', () => {
    expect(() => readRealBrowserExceptions(write('{'))).toThrow(
      /budget-real-browser\.json is not valid JSON/,
    );
    expect(() => readRealBrowserExceptions(write('{}'))).toThrow(/must be an array/);
  });

  it('reads a missing file as no entries', () => {
    expect(
      readRealBrowserExceptions(join(tmpdir(), 'no-such-dir', 'budget-real-browser.json')),
    ).toEqual([]);
  });
});
