#!/usr/bin/env node
/**
 * Measures the JavaScript a built page of the site requests (the spike's numbers in SPIKE.md),
 * gzipped as scripts/verify-dist.mjs gzips: Node's `gzipSync` at zlib's default level.
 *
 * - First load: the page's inline scripts, its external scripts and module preloads, and the
 *   component, renderer and before-hydration modules of every island (an island in the first
 *   viewport hydrates at once, `client:visible` included), each with its static imports.
 * - Later: the modules reachable only through a dynamic `import()` of those, with their static
 *   imports (loaded only if that code path runs).
 * - React copies: the chunks of all of `dist` that hold React's core (it assigns
 *   `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`) and react-dom's client (it
 *   names its `rendererPackageName`); one of each is expected.
 *
 * Usage: node scripts/measure-page.mjs [page.html under dist, default index.html] [--json]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BASE = '/waveui/docs/';
const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(siteRoot, 'dist');

/** Static `import … from "./x.js"`, `import "./x.js"` and `export … from "./x.js"` of a chunk. */
const STATIC_IMPORT =
  /\b(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?["'`](\.{1,2}\/[^"'`]+?\.js)["'`]/g;
/** Dynamic `import("./x.js")` of a chunk. */
const DYNAMIC_IMPORT = /\bimport\(\s*["'`](\.{1,2}\/[^"'`]+?\.js)["'`]\s*\)/g;

const gzip = (text) => gzipSync(text).length;

/**
 * An asset address of a page as a path under the app's base (`/waveui/docs/_assets/x.js` is
 * `_assets/x.js`), which is how `readAsset` and the report name a file.
 */
function pathOfUrl(url) {
  if (!url.startsWith(BASE)) throw new Error(`asset URL outside ${BASE}: ${url}`);
  return url.slice(BASE.length);
}

/** The path under the base that `spec`, a relative import of the file at `fromPath`, names. */
function resolveImport(fromPath, spec) {
  return pathOfUrl(new URL(spec, `http://site${BASE}${fromPath}`).pathname);
}

/**
 * The modules `entries` (paths under the base) load, statically (`loaded`), and the dynamic
 * imports they hold.
 */
function staticClosure(entries, readAsset, loaded = new Set()) {
  const dynamic = new Set();
  const visit = (path) => {
    if (loaded.has(path)) return;
    loaded.add(path);
    const code = String(readAsset(path));
    for (const [, spec] of code.matchAll(STATIC_IMPORT)) visit(resolveImport(path, spec));
    for (const [, spec] of code.matchAll(DYNAMIC_IMPORT)) dynamic.add(resolveImport(path, spec));
  };
  for (const entry of entries) visit(entry);
  return { loaded, dynamic };
}

/** A `src` attribute of any quoting (the lead whitespace keeps `data-src` out). */
const SRC_ATTRIBUTE = /(?<=\s)src\s*=/;

/** The value of the attribute `name` in an opening tag's attribute text, double or single quoted. */
function attributeValue(attributes, name) {
  const match = new RegExp(`(?<=\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attributes);
  return match ? (match[1] ?? match[2]) : undefined;
}

/**
 * The addresses of the scripts a page loads before any island code: the `src` of its scripts, then
 * its module preloads (`rel` has the token `modulepreload`, `href` in either order), then the
 * `component-url`, `renderer-url` and `before-hydration-url` of its islands; each address once, in
 * that order. Attribute values may use double or single quotes (an unquoted one is not read:
 * `scripts/check-budget.mjs` compares this count with its own HTML parse and reports the gap).
 */
export function pageScriptAddresses(html) {
  const urls = new Set();
  for (const [, attributes] of html.matchAll(/<script\b([^>]*)>/g)) {
    const src = attributeValue(attributes, 'src');
    if (src !== undefined) urls.add(src);
  }
  for (const [, attributes] of html.matchAll(/<link\b([^>]*)>/g)) {
    const rel = attributeValue(attributes, 'rel') ?? '';
    const href = attributeValue(attributes, 'href');
    if (href !== undefined && rel.split(/\s+/).includes('modulepreload')) urls.add(href);
  }
  for (const [, attributes] of html.matchAll(/<[a-z][\w-]*\b([^>]*)>/gi)) {
    for (const name of ['component-url', 'renderer-url', 'before-hydration-url']) {
      const value = attributeValue(attributes, name);
      if (value !== undefined) urls.add(value);
    }
  }
  return [...urls];
}

/**
 * The JavaScript a page requests, from its HTML and a reader of its assets (`readAsset(path)`
 * gives the file at `path` under the base, `_assets/x.js`, as a string or a Buffer): the rows of
 * the first load (inline scripts, scripts, preloads and islands with their static imports), the
 * rows of what only dynamic imports add, and the totals, gzipped. A script, preload or island
 * outside the base throws, or is left out with `foreign: 'skip'` (the budget gate reports it as a
 * problem of its own). `measurePage` and `scripts/check-budget.mjs` share this measuring.
 */
export function pageJsReport(html, readAsset, { foreign = 'throw' } = {}) {
  const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attributes]) => !SRC_ATTRIBUTE.test(attributes))
    .map(([, , body]) => body)
    .filter((body) => body.trim() !== '');
  const entries = pageScriptAddresses(html)
    .filter((url) => foreign === 'throw' || url.startsWith(BASE))
    .map(pathOfUrl);

  const first = staticClosure(entries, readAsset);
  const later = new Set();
  let pending = [...first.dynamic];
  while (pending.length > 0) {
    const next = staticClosure(pending, readAsset, new Set([...first.loaded, ...later]));
    const added = [...next.loaded].filter((file) => !first.loaded.has(file) && !later.has(file));
    for (const file of added) later.add(file);
    pending = [...next.dynamic].filter((file) => !first.loaded.has(file) && !later.has(file));
  }

  const row = (path) => {
    const code = String(readAsset(path));
    return { file: path, raw: Buffer.byteLength(code), gzip: gzip(code) };
  };
  const firstRows = [...first.loaded].map(row);
  const laterRows = [...later].map(row);
  const inlineRows = inline.map((body, index) => ({
    file: `<inline script ${index + 1}>`,
    raw: Buffer.byteLength(body),
    gzip: gzip(body),
  }));
  const sum = (rows, key) => rows.reduce((total, item) => total + item[key], 0);

  return {
    inline: inlineRows,
    firstLoad: firstRows,
    later: laterRows,
    totals: {
      inlineGzip: sum(inlineRows, 'gzip'),
      firstLoadGzip: sum(inlineRows, 'gzip') + sum(firstRows, 'gzip'),
      firstLoadRaw: sum(inlineRows, 'raw') + sum(firstRows, 'raw'),
      laterGzip: sum(laterRows, 'gzip'),
      everythingGzip: sum(inlineRows, 'gzip') + sum(firstRows, 'gzip') + sum(laterRows, 'gzip'),
    },
  };
}

/**
 * {@link pageJsReport} of a built page of `distDir` (default: the site's `dist`), with the chunks
 * that hold React's copies.
 */
export function measurePage(pageFile, distDir = dist) {
  const html = readFileSync(pageFile, 'utf8');
  const report = pageJsReport(html, (path) => readFileSync(join(distDir, path)));

  const assets = join(distDir, '_assets');
  const chunks = readdirSync(assets).filter((name) => name.endsWith('.js'));
  const holding = (marker) =>
    chunks.filter((name) => readFileSync(join(assets, name), 'utf8').includes(marker));

  return {
    page: relative(distDir, pageFile).replaceAll('\\', '/'),
    ...report,
    reactCoreChunks: holding('__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE='),
    reactDomClientChunks: holding('rendererPackageName'),
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const page = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'index.html';
  const result = measurePage(join(dist, page));
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const kb = (bytes) => `${bytes} B (${(bytes / 1024).toFixed(1)} KiB)`;
    const print = (title, rows) => {
      console.log(title);
      for (const item of rows)
        console.log(`  ${item.file}: ${kb(item.raw)} raw, ${kb(item.gzip)} gzip`);
    };
    console.log(`page: ${result.page}`);
    print('inline scripts:', result.inline);
    print('first load (static closure of scripts, preloads and islands):', result.firstLoad);
    print('later (dynamic imports only):', result.later);
    const t = result.totals;
    console.log(`first-load JavaScript: ${kb(t.firstLoadGzip)} gzip (${kb(t.firstLoadRaw)} raw)`);
    console.log(`later: ${kb(t.laterGzip)} gzip; everything: ${kb(t.everythingGzip)} gzip`);
    console.log(`React core chunks: ${result.reactCoreChunks.join(', ') || 'none'}`);
    console.log(`react-dom client chunks: ${result.reactDomClientChunks.join(', ') || 'none'}`);
  }
}
