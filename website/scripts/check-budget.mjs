#!/usr/bin/env node
/**
 * The budget and base-path gate of the built site (`npm run site:check`): reads every HTML page of
 * `dist` and fails, with a per-page report, when one breaks a limit of the spec
 * (docs/superpowers/specs/2026-11-07-docs-site-design.md, "Performance (hard limits)").
 *
 * Limits (gzipped, Node's `gzipSync` at zlib's default level, as `scripts/measure-page.mjs`
 * measures; `website/BUDGET.md` is the method and the table):
 *
 * - first-load JavaScript of a page: at most {@link LIMITS}.firstLoadGzip. The metric is the
 *   conservative static one of `measure-page.mjs`: every island of the page counts as first load,
 *   `client:visible` ones included, so it is an upper bound (a browser loads fewer scripts before
 *   scrolling; the launch check with Lighthouse measures that).
 * - everything a page can ever request (first load, the scripts only dynamic imports add, and the
 *   data files the scripts name, the search index): at most {@link LIMITS}.totalGzip.
 *
 * A page over the first-load limit is allowed only through `website/budget-exceptions.json`, a
 * documented decision: `{ page, firstLoadGzip, reason }` per page, the measured number the day it
 * was recorded. The page passes while its measured first load is at most that number plus
 * {@link BUDGET_MARGIN} (1,024 B: room for byte differences of the bundler and zlib between
 * platforms, and for a library change that grows shared code a little, without re-recording);
 * above that (a regression), or for a page that is under the limit again, the gate fails. An entry
 * is never raised silently: the report prints each exception with its headroom against the
 * recorded number plus the margin. `website/README.md` has the procedure to re-record.
 *
 * Rules of the page itself (the build-time twin of `tests/pages.test.ts`, which stays):
 *
 * - every address (`href`, `src`, `srcset`, `action`, `poster`, the islands' `component-url`,
 *   `renderer-url`, `before-hydration-url` and props, `url()` and `@import` of inline and linked
 *   CSS, inline scripts' paths, `meta content`) is under `/waveui/docs/`; the only other address
 *   is the single Close link `/waveui`, and an `https` link to GitHub or npm inside a guide's
 *   content (`[data-guide-content]`);
 * - scripts, module preloads and islands come from `/waveui/docs/_assets/`;
 * - no `<iframe>`, no web font (a `@font-face` rule, a font file, a font host), no reference to
 *   the stories' image host `i.pravatar.cc`;
 * - `<html>` has `lang` and `dir`; the page has exactly one `<main>`.
 *
 * Usage: node scripts/check-budget.mjs [dist directory, default website/dist]
 *                                      [--exceptions <file, default website/budget-exceptions.json>]
 * Exit code 1 when a page breaks a limit or a rule (or `dist` holds no build).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { BASE, pageJsReport, pageScriptAddresses } from './measure-page.mjs';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The limits, in bytes gzipped (150 KB is read as 150,000 B, the spec's number as in BUDGET.md). */
export const LIMITS = { firstLoadGzip: 150_000, totalGzip: 250_000 };

/**
 * How far above its recorded number a documented exception may measure before it fails, in bytes
 * gzipped: the same for this gate and the real-browser one (`real-browser-budget.mjs`). It never
 * lets a page that is not listed go over the limit.
 */
export const BUDGET_MARGIN = 1_024;

/** The app's address prefix, without the trailing slash, and the one address outside it. */
const DOCS_BASE = BASE.slice(0, -1);
const CLOSE_URL = '/waveui';
/**
 * The homepage's origin, which owns the app's addresses: a page's `<link rel="canonical">` names its
 * own address there. The same value as `CANONICAL_ORIGIN` in `src/shell/urls.ts` (a test keeps them
 * equal).
 */
export const CANONICAL_ORIGIN = 'https://brudvik.com';
const ASSETS = `${BASE}_assets/`;
const IMAGE_HOST = 'i.pravatar.cc';

const kb = (bytes) => bytes.toLocaleString('en-US');
const gzip = (data) => gzipSync(data).length;

/** Void elements: no closing tag. */
const VOID = new Set(
  'area base br col embed hr img input link meta param source track wbr'.split(' '),
);
const URL_ATTRIBUTES = [
  'href',
  'src',
  'action',
  'poster',
  'component-url',
  'renderer-url',
  'before-hydration-url',
];
/** A whole string that is an address: `/x`, `//host/x` or `scheme://…`. */
const ADDRESS = /^(?:[a-z][a-z0-9+.-]*:\/\/|\/)\S*$/i;
const CSS_URL = /url\(\s*(['"]?)([^'")]*)\1\s*\)|@import\s+(['"])([^'"]+)\3/g;
const FONT_FILE = /\.(?:woff2?|ttf|otf|eot)(?:[?#].*)?$/i;
const FONT_HOST =
  /(?:^|\/\/|\.)(?:fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|use\.fontawesome\.com|kit\.fontawesome\.com)\b/i;
const EXTERNAL_GUIDE_HOSTS = new Set(['github.com', 'www.npmjs.com', 'npmjs.com']);

const TAG =
  /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const decode = (text) =>
  text
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');

/** Whether `href` may stay a link in a guide: `https` to GitHub or npm (as `src/docs/markdown.ts`). */
function isAllowedExternalLink(href) {
  try {
    const url = new URL(href);
    return (
      url.protocol === 'https:' && EXTERNAL_GUIDE_HOSTS.has(url.hostname) && url.username === ''
    );
  } catch {
    return false;
  }
}

/** The page's elements, with the bodies of its scripts and styles apart. */
function parseHtml(html) {
  const scriptBodies = [];
  const styleBodies = [];
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi,
      (_all, open, name, body, close) => {
        (name.toLowerCase() === 'script' ? scriptBodies : styleBodies).push(body);
        return `${open}${close}`;
      },
    );
  const elements = [];
  const stack = [];
  for (const match of markup.matchAll(TAG)) {
    const [, closing, rawName, rawAttributes, selfClosing] = match;
    const name = rawName.toLowerCase();
    if (closing) {
      const index = stack.findLastIndex((entry) => entry.name === name);
      if (index !== -1) stack.length = index;
      continue;
    }
    const attributes = new Map();
    for (const [, key, double, single, bare] of rawAttributes.matchAll(ATTRIBUTE)) {
      attributes.set(key.toLowerCase(), decode(double ?? single ?? bare ?? ''));
    }
    const inGuide = stack.some((entry) => entry.guide);
    elements.push({ name, attributes, inGuide });
    if (!VOID.has(name) && !selfClosing) {
      stack.push({ name, guide: attributes.has('data-guide-content') });
    }
  }
  return { elements, scriptBodies, styleBodies };
}

/** `url()` and `@import` addresses of CSS text, as paths (a relative one resolved against `base`). */
function cssAddresses(css, base) {
  return [...css.matchAll(CSS_URL)]
    .map((match) => (match[2] ?? match[4] ?? '').trim())
    .filter((url) => url && !url.startsWith('data:') && !url.startsWith('#'))
    .map((url) =>
      /^[a-z][a-z0-9+.-]*:|^\//i.test(url) ? url : new URL(url, `http://site${base}`).pathname,
    );
}

/** Every string of a parsed island prop value that is an address. */
function propAddresses(value) {
  if (typeof value === 'string') return ADDRESS.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(propAddresses);
  if (value && typeof value === 'object') return Object.values(value).flatMap(propAddresses);
  return [];
}

/**
 * Measures one page and applies the rules above. `readAsset(path)` gives the file at `path` under
 * the base (`_assets/x.js`) and throws when it is absent. `exception` is the page's entry of
 * `budget-exceptions.json` (`{ firstLoadGzip, reason }`), if it has one.
 *
 * @param {string} html
 * @param {(path: string) => Buffer} readAsset
 * @param {{ firstLoadGzip: number, reason: string } | undefined} [exception]
 * @returns {{ firstLoadGzip: number, totalGzip: number, problems: string[],
 *   overLimit: boolean, excepted: boolean }}
 */
export function checkPage(html, readAsset, exception) {
  const problems = [];
  const read = (path, what) => {
    try {
      return readAsset(path);
    } catch {
      problems.push(`${what} ${path} is requested but the build has no such file`);
      return undefined;
    }
  };

  // The JavaScript: first load, and what only dynamic imports and data files add.
  let report = {
    firstLoad: [],
    later: [],
    totals: { firstLoadGzip: 0, laterGzip: 0, everythingGzip: 0 },
  };
  try {
    report = pageJsReport(html, readAsset, { foreign: 'skip' });
  } catch (error) {
    problems.push(`its scripts could not be measured: ${error.message}`);
  }
  const scriptFiles = [...report.firstLoad, ...report.later].map((row) => row.file);
  let dataGzip = 0;
  const dataFiles = new Set();
  for (const file of scriptFiles) {
    let code;
    try {
      code = String(readAsset(file));
    } catch {
      continue;
    }
    for (const [, name] of code.matchAll(/_assets\/([\w.-]+\.json)/g))
      dataFiles.add(`_assets/${name}`);
    if (code.includes(IMAGE_HOST)) problems.push(`the script ${file} references ${IMAGE_HOST}`);
  }
  for (const file of dataFiles) {
    const data = read(file, 'the data file');
    if (data) dataGzip += gzip(data);
  }
  const firstLoadGzip = report.totals.firstLoadGzip;
  const totalGzip = report.totals.everythingGzip + dataGzip;

  const overLimit = firstLoadGzip > LIMITS.firstLoadGzip;
  let excepted = false;
  if (overLimit) {
    const largest = [...report.inline, ...report.firstLoad]
      .sort((a, b) => b.gzip - a.gzip)
      .slice(0, 3)
      .map((row) => `${row.file}, ${kb(row.gzip)} B`)
      .join('; ');
    const message = `first-load JavaScript is ${kb(firstLoadGzip)} B gzipped, above the ${kb(LIMITS.firstLoadGzip)} B limit (largest scripts: ${largest})`;
    if (!exception) {
      problems.push(message);
    } else if (firstLoadGzip > exception.firstLoadGzip + BUDGET_MARGIN) {
      problems.push(
        `${message}, and above its recorded ${kb(exception.firstLoadGzip)} B plus the ${kb(BUDGET_MARGIN)} B margin in budget-exceptions.json (a regression: fix the page, or re-record the number deliberately with the reason)`,
      );
    } else {
      excepted = true;
    }
  } else if (exception) {
    problems.push(
      `budget-exceptions.json lists this page at ${kb(exception.firstLoadGzip)} B but its first load is ${kb(firstLoadGzip)} B, under the ${kb(LIMITS.firstLoadGzip)} B limit: remove it`,
    );
  }
  if (totalGzip > LIMITS.totalGzip) {
    problems.push(
      `everything the page can request is ${kb(totalGzip)} B gzipped (first load ${kb(firstLoadGzip)}, scripts loaded later ${kb(report.totals.laterGzip)}, data files ${kb(dataGzip)}), above the ${kb(LIMITS.totalGzip)} B limit`,
    );
  }

  // The markup.
  const { elements, scriptBodies, styleBodies } = parseHtml(html);

  // The measurement reads script addresses with patterns of its own; this parse reads the same
  // addresses by element. If the two counts differ, the measurement missed (or invented) a script
  // and the first-load number is not to be trusted: an undercount is a problem, never silent.
  const parsedAddresses = new Set();
  for (const { name, attributes } of elements) {
    if (name === 'script' && attributes.has('src')) parsedAddresses.add(attributes.get('src'));
    if (
      name === 'link' &&
      (attributes.get('rel') ?? '').split(/\s+/).includes('modulepreload') &&
      attributes.has('href')
    ) {
      parsedAddresses.add(attributes.get('href'));
    }
    for (const key of ['component-url', 'renderer-url', 'before-hydration-url']) {
      if (attributes.has(key)) parsedAddresses.add(attributes.get(key));
    }
  }
  const measuredAddresses = pageScriptAddresses(html).length;
  if (measuredAddresses !== parsedAddresses.size) {
    problems.push(
      `the measurement counted ${measuredAddresses} script or modulepreload address${measuredAddresses === 1 ? '' : 'es'} but the HTML has ${parsedAddresses.size}: the first-load number leaves a script out (an attribute the measurement does not read, such as an unquoted value)`,
    );
  }
  const outside = (value, where) => problems.push(`${where} names "${value}", outside ${BASE}`);
  const isFont = (value) => FONT_FILE.test(value.split(/[?#]/)[0]) || FONT_HOST.test(value);
  const fontProblem = (value, where) =>
    problems.push(`web font: ${where} names "${value}" (the site uses the system font stack)`);
  /** An address of the app: under the base, not the base twice, not a directory. */
  const checkAddress = (value, where) => {
    if (isFont(value)) return fontProblem(value, where);
    const path = value.split(/[?#]/)[0];
    const internal =
      path.startsWith(`${BASE}`) &&
      !path.slice(DOCS_BASE.length).includes('/waveui/') &&
      !path.endsWith('/');
    if (!internal) outside(value, where);
  };

  const sheets = [];
  let closeLinks = 0;
  const html0 = elements.find((element) => element.name === 'html');
  for (const key of ['lang', 'dir']) {
    if (!html0?.attributes.get(key)?.trim()) problems.push(`<html> has no ${key} attribute`);
  }
  const mains = elements.filter((element) => element.name === 'main').length;
  if (mains !== 1) problems.push(`the page has ${mains} <main> elements, expected exactly one`);

  for (const { name, attributes, inGuide } of elements) {
    if (name === 'iframe') problems.push('the page holds an <iframe>');
    const tag = `<${name}>`;
    const isScriptUrl = (key) =>
      (name === 'script' && key === 'src') ||
      (name === 'link' && attributes.get('rel') === 'modulepreload' && key === 'href') ||
      key === 'component-url' ||
      key === 'renderer-url' ||
      key === 'before-hydration-url';
    for (const key of URL_ATTRIBUTES) {
      const value = attributes.get(key);
      if (value === undefined || value.startsWith('#') || value.startsWith('data:')) continue;
      if (name === 'a' && key === 'href' && value === CLOSE_URL) {
        closeLinks++;
        continue;
      }
      if (name === 'a' && key === 'href' && inGuide && isAllowedExternalLink(value)) continue;
      // A canonical link points at a page, it loads nothing: on the homepage's origin it must name
      // an address of the app (the same rules as any other address, the app's index included).
      if (
        name === 'link' &&
        key === 'href' &&
        attributes.get('rel') === 'canonical' &&
        value.startsWith(`${CANONICAL_ORIGIN}/`)
      ) {
        const path = value.slice(CANONICAL_ORIGIN.length);
        if (path !== DOCS_BASE) checkAddress(path, `${tag} ${key}`);
        continue;
      }
      checkAddress(value, `${tag} ${key}`);
      if (isScriptUrl(key) && !value.startsWith(ASSETS) && !isFont(value)) {
        problems.push(`${tag} ${key} "${value}" is not under ${ASSETS}`);
      }
    }
    if (name === 'link' && attributes.get('as') === 'font') {
      problems.push('web font: a <link as="font"> preloads a font');
    }
    for (const candidate of (attributes.get('srcset') ?? '').split(',')) {
      const value = candidate.trim().split(/\s+/)[0];
      if (value && !value.startsWith('data:')) checkAddress(value, `${tag} srcset`);
    }
    const style = attributes.get('style');
    if (style) {
      for (const url of cssAddresses(style, DOCS_BASE)) checkAddress(url, `${tag} style`);
      if (/@font-face/i.test(style))
        problems.push('web font: a @font-face rule in a style attribute');
    }
    if (name === 'meta') {
      const content = attributes.get('content') ?? '';
      if (ADDRESS.test(content)) checkAddress(content, '<meta> content');
    }
    if (name === 'astro-island') {
      let props = {};
      try {
        props = JSON.parse(attributes.get('props') ?? '{}');
      } catch {
        problems.push('an <astro-island> has props that are not JSON');
      }
      for (const url of propAddresses(props)) checkAddress(url, '<astro-island> props');
    }
    if (name === 'link' && attributes.get('rel') === 'stylesheet' && attributes.has('href')) {
      sheets.push(attributes.get('href'));
    }
  }
  if (closeLinks !== 1) {
    problems.push(`expected exactly one Close link (href="${CLOSE_URL}"), found ${closeLinks}`);
  }

  for (const body of scriptBodies) {
    for (const [url] of body.matchAll(/["'`(]\/(?!\/)[^"'`)\s]*/g)) {
      checkAddress(url.slice(1), 'an inline script');
    }
    if (body.includes(IMAGE_HOST)) problems.push(`an inline script references ${IMAGE_HOST}`);
  }
  for (const body of styleBodies) {
    for (const url of cssAddresses(body, DOCS_BASE)) checkAddress(url, 'a <style> element');
    if (/@font-face/i.test(body)) problems.push('web font: a @font-face rule in a <style> element');
  }
  for (const sheet of sheets) {
    if (!sheet.startsWith(BASE) || sheet.startsWith('data:')) continue;
    const path = sheet.slice(BASE.length).split(/[?#]/)[0];
    const css = read(path, 'the stylesheet');
    if (css === undefined) continue;
    const text = String(css);
    for (const url of cssAddresses(text, sheet.split(/[?#]/)[0]))
      checkAddress(url, `the stylesheet ${path}`);
    if (/@font-face/i.test(text)) problems.push(`web font: a @font-face rule in ${path}`);
  }
  if (html.includes(IMAGE_HOST)) problems.push(`the page references ${IMAGE_HOST}`);

  return { firstLoadGzip, totalGzip, problems: [...new Set(problems)], overLimit, excepted };
}

/** Every HTML page under `dist` (not `_assets`), as names without the extension: `components/button`. */
function pageNames(dist, directory = dist) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const path = join(directory, item.name);
    if (item.isDirectory()) return item.name === '_assets' ? [] : pageNames(dist, path);
    return item.name.endsWith('.html')
      ? [
          relative(dist, path)
            .replaceAll('\\', '/')
            .replace(/\.html$/, ''),
        ]
      : [];
  });
}

/** The entries of the exceptions file, or the problems with it. */
function readExceptions(file) {
  if (!file || !existsSync(file)) return { entries: [], problems: [] };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return {
      entries: [],
      problems: [`budget-exceptions.json is not valid JSON: ${error.message}`],
    };
  }
  if (!Array.isArray(parsed)) {
    return {
      entries: [],
      problems: ['budget-exceptions.json must be an array of { page, firstLoadGzip, reason }'],
    };
  }
  const problems = [];
  const entries = new Map();
  for (const item of parsed) {
    const page = typeof item?.page === 'string' ? item.page : undefined;
    if (!page) {
      problems.push('budget-exceptions.json: an entry has no page');
      continue;
    }
    if (entries.has(page)) problems.push(`budget-exceptions.json lists ${page} twice`);
    if (!Number.isInteger(item.firstLoadGzip) || item.firstLoadGzip <= 0) {
      problems.push(
        `budget-exceptions.json: ${page} needs a firstLoadGzip, the measured bytes (a positive integer)`,
      );
    }
    if (typeof item.reason !== 'string' || item.reason.trim() === '') {
      problems.push(`budget-exceptions.json: ${page} needs a reason, the documented decision`);
    }
    entries.set(page, item);
  }
  return { entries: [...entries.values()], problems };
}

/**
 * Checks every page of `dist` against the limits and the rules, with the exceptions of `file`.
 * `problems` holds each page's problems prefixed with the page, then the file's own.
 */
export function checkSite(dist, exceptionsFile) {
  const { entries, problems: fileProblems } = readExceptions(exceptionsFile);
  const byPage = new Map(entries.map((entry) => [entry.page, entry]));
  const names = pageNames(dist).sort();
  const valid = (entry) =>
    entry &&
    Number.isInteger(entry.firstLoadGzip) &&
    entry.firstLoadGzip > 0 &&
    typeof entry.reason === 'string' &&
    entry.reason.trim() !== '';
  const readAsset = (path) => readFileSync(join(dist, path));

  const pages = [];
  const problems = [];
  const exceptions = [];
  for (const name of names) {
    const entry = byPage.get(name);
    const html = readFileSync(join(dist, `${name}.html`), 'utf8');
    const result = checkPage(html, readAsset, valid(entry) ? entry : undefined);
    pages.push({ page: name, ...result });
    for (const problem of result.problems) problems.push(`${name}: ${problem}`);
    if (result.excepted) {
      exceptions.push({
        page: name,
        recorded: entry.firstLoadGzip,
        ceiling: entry.firstLoadGzip + BUDGET_MARGIN,
        measured: result.firstLoadGzip,
        headroom: entry.firstLoadGzip + BUDGET_MARGIN - result.firstLoadGzip,
        reason: entry.reason,
      });
    }
  }
  for (const entry of entries) {
    if (!names.includes(entry.page)) {
      problems.push(`budget-exceptions.json lists ${entry.page}, but the build has no such page`);
    }
  }
  problems.push(...fileProblems);

  const worst = [...pages].sort((a, b) => b.firstLoadGzip - a.firstLoadGzip).slice(0, 5);
  return {
    pages,
    problems,
    exceptions,
    worst,
    over: pages.filter((page) => page.overLimit).length,
  };
}

function printReport(result, exceptionsFile) {
  const table = (rows) => {
    const widths = rows[0].map((_, column) =>
      Math.max(...rows.map((row) => String(row[column]).length)),
    );
    for (const row of rows) {
      console.log(
        '  ' +
          row
            .map((cell, column) =>
              column === 0
                ? String(cell).padEnd(widths[column])
                : String(cell).padStart(widths[column]),
            )
            .join('  '),
      );
    }
  };
  console.log(
    `site:check budget: ${result.pages.length} pages (first load limit ${kb(LIMITS.firstLoadGzip)} B gzipped, everything ${kb(LIMITS.totalGzip)} B; every island counted as first load)`,
  );
  console.log('worst five by first load:');
  table([
    ['page', 'first load', 'everything'],
    ...result.worst.map((page) => [page.page, kb(page.firstLoadGzip), kb(page.totalGzip)]),
  ]);
  console.log(
    `pages over the first-load limit: ${result.over} (${result.exceptions.length} documented in ${exceptionsFile ? relative(process.cwd(), exceptionsFile).replaceAll('\\', '/') : 'budget-exceptions.json'})`,
  );
  if (result.exceptions.length > 0) {
    console.log(
      `documented exceptions (allowed up to recorded + ${kb(BUDGET_MARGIN)} B; headroom against that):`,
    );
    table([
      ['page', 'recorded', 'allowed', 'measured', 'headroom'],
      ...result.exceptions.map((item) => [
        item.page,
        kb(item.recorded),
        kb(item.ceiling),
        kb(item.measured),
        kb(item.headroom),
      ]),
    ]);
  }
  console.log(`problems: ${result.problems.length}`);
  for (const problem of result.problems) console.log(`  - ${problem}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const optionAt = args.indexOf('--exceptions');
  const exceptionsFile = resolve(
    optionAt === -1 ? join(siteRoot, 'budget-exceptions.json') : (args[optionAt + 1] ?? ''),
  );
  const positional = args.filter(
    (arg, index) => !arg.startsWith('--') && (optionAt === -1 || index !== optionAt + 1),
  );
  const dist = resolve(positional[0] ?? join(siteRoot, 'dist'));
  if (!existsSync(dist) || pageNames(dist).length === 0) {
    console.error(`site:check: ${dist} holds no build; run npm run site:build first`);
    process.exit(1);
  }
  const result = checkSite(dist, exceptionsFile);
  printReport(result, exceptionsFile);
  process.exit(result.problems.length > 0 ? 1 : 0);
}
