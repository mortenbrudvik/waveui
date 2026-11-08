/**
 * The rules of the real-browser budget (`e2e/budget.spec.ts` measures, this module judges): the
 * first-load JavaScript of every page in Chromium, at the two viewports of {@link VIEWPORTS}, cold
 * cache, no scrolling or interaction, gzipped as `scripts/verify-dist.mjs` gzips. The limit is the
 * static gate's (`check-budget.mjs`, 150,000 B), and the exceptions work the same way:
 * `website/budget-real-browser.json` lists `{ page, viewport, firstLoadGzip, reason }`, and a page
 * over the limit passes only while it is listed and not above its recorded number. An entry for a
 * page that is under the limit now, or that the build no longer has, fails ("remove it"). Raising
 * a number is a deliberate edit with its reason. `website/BUDGET.md` ("Real browser") has the
 * method and the numbers.
 */
import { existsSync, readFileSync } from 'node:fs';
import { LIMITS } from './check-budget.mjs';

/** The first-load limit, in bytes gzipped: the static gate's. */
export const REAL_BROWSER_LIMIT = LIMITS.firstLoadGzip;

/** The viewports the budget is measured at, by the names the exceptions use. */
export const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 } },
  phone: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  },
};

const FILE = 'budget-real-browser.json';
const bytes = (value) => `${value.toLocaleString('en-US')} B`;
const key = (page, viewport) => `${page} @ ${viewport}`;

/** The entries of the exceptions file (none when it is absent); throws for a malformed file. */
export function readRealBrowserExceptions(file) {
  if (!existsSync(file)) return [];
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${FILE} is not valid JSON: ${error.message}`, { cause: error });
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${FILE} must be an array of { page, viewport, firstLoadGzip, reason }`);
  }
  return parsed;
}

/**
 * Judges measured `rows` (`{ page, viewport, firstLoadGzip }`) against the limit and the
 * `exceptions`. Entries of a viewport no row measured are left alone (a run of one viewport).
 * Returns the `problems`, in words, and the pages that passed through an entry (`excepted`, with
 * their headroom).
 */
export function checkRealBrowserBudget(rows, exceptions) {
  const problems = [];
  const entries = new Map();
  for (const item of exceptions) {
    const page = typeof item?.page === 'string' ? item.page : undefined;
    if (!page) {
      problems.push(`${FILE}: an entry has no page`);
      continue;
    }
    if (!Object.hasOwn(VIEWPORTS, item.viewport)) {
      problems.push(
        `${FILE}: ${page} has the viewport "${item.viewport}"; use ${Object.keys(VIEWPORTS).join(' or ')}`,
      );
      continue;
    }
    const name = key(page, item.viewport);
    if (entries.has(name)) {
      problems.push(`${FILE} lists ${name} twice`);
      continue;
    }
    if (!Number.isInteger(item.firstLoadGzip) || item.firstLoadGzip <= 0) {
      problems.push(
        `${FILE}: ${name} needs a firstLoadGzip, the measured bytes (a positive integer)`,
      );
      continue;
    }
    if (typeof item.reason !== 'string' || item.reason.trim() === '') {
      problems.push(`${FILE}: ${name} needs a reason, the documented decision`);
      continue;
    }
    entries.set(name, item);
  }

  const excepted = [];
  const measured = new Set();
  for (const { page, viewport, firstLoadGzip } of rows) {
    const name = key(page, viewport);
    measured.add(name);
    const entry = entries.get(name);
    if (firstLoadGzip <= REAL_BROWSER_LIMIT) {
      if (entry) {
        problems.push(
          `${FILE} lists ${name} at ${bytes(entry.firstLoadGzip)}, but it measures ${bytes(firstLoadGzip)}, under the limit: remove the entry`,
        );
      }
    } else if (!entry) {
      problems.push(
        `${name}: ${bytes(firstLoadGzip)} of first-load JavaScript in a real browser, above the ${bytes(REAL_BROWSER_LIMIT)} limit; bring it down, or record it in ${FILE} with its reason`,
      );
    } else if (firstLoadGzip > entry.firstLoadGzip) {
      problems.push(
        `${name}: ${bytes(firstLoadGzip)} of first-load JavaScript in a real browser, above its recorded ${bytes(entry.firstLoadGzip)} in ${FILE} (a regression: bring it down, or raise the record deliberately with its reason)`,
      );
    } else {
      excepted.push({
        page,
        viewport,
        recorded: entry.firstLoadGzip,
        measured: firstLoadGzip,
        headroom: entry.firstLoadGzip - firstLoadGzip,
        reason: entry.reason,
      });
    }
  }

  const viewportsMeasured = new Set(rows.map((item) => item.viewport));
  for (const [name, entry] of entries) {
    if (viewportsMeasured.has(entry.viewport) && !measured.has(name)) {
      problems.push(`${FILE} lists ${name}, but the build has no such page`);
    }
  }
  return { problems, excepted };
}
