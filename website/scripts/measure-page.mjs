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

const BASE = '/waveui/docs/';
const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(siteRoot, 'dist');

/** Static `import … from "./x.js"`, `import "./x.js"` and `export … from "./x.js"` of a chunk. */
const STATIC_IMPORT =
  /\b(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?["'`](\.{1,2}\/[^"'`]+?\.js)["'`]/g;
/** Dynamic `import("./x.js")` of a chunk. */
const DYNAMIC_IMPORT = /\bimport\(\s*["'`](\.{1,2}\/[^"'`]+?\.js)["'`]\s*\)/g;

const gzip = (text) => gzipSync(text).length;

function fileOfUrl(url) {
  if (!url.startsWith(BASE)) throw new Error(`asset URL outside ${BASE}: ${url}`);
  return join(dist, url.slice(BASE.length));
}

/** The modules `entries` load, statically (`loaded`), and the dynamic imports they hold. */
function staticClosure(entries, loaded = new Set()) {
  const dynamic = new Set();
  const visit = (file) => {
    if (loaded.has(file)) return;
    loaded.add(file);
    const code = readFileSync(file, 'utf8');
    for (const [, spec] of code.matchAll(STATIC_IMPORT)) visit(resolve(dirname(file), spec));
    for (const [, spec] of code.matchAll(DYNAMIC_IMPORT)) dynamic.add(resolve(dirname(file), spec));
  };
  for (const entry of entries) visit(entry);
  return { loaded, dynamic };
}

export function measurePage(pageFile) {
  const html = readFileSync(pageFile, 'utf8');
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(([, body]) => body)
    .filter((body) => body.trim() !== '');
  const entryUrls = new Set();
  for (const [, url] of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) entryUrls.add(url);
  for (const [, url] of html.matchAll(/<link[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g)) {
    entryUrls.add(url);
  }
  for (const [, url] of html.matchAll(
    /\b(?:component-url|renderer-url|before-hydration-url)="([^"]+)"/g,
  )) {
    entryUrls.add(url);
  }

  const first = staticClosure([...entryUrls].map(fileOfUrl));
  const later = new Set();
  let pending = [...first.dynamic];
  while (pending.length > 0) {
    const next = staticClosure(pending, new Set([...first.loaded, ...later]));
    const added = [...next.loaded].filter((file) => !first.loaded.has(file) && !later.has(file));
    for (const file of added) later.add(file);
    pending = [...next.dynamic].filter((file) => !first.loaded.has(file) && !later.has(file));
  }

  const row = (file) => {
    const code = readFileSync(file, 'utf8');
    return {
      file: relative(dist, file).replaceAll('\\', '/'),
      raw: Buffer.byteLength(code),
      gzip: gzip(code),
    };
  };
  const firstRows = [...first.loaded].map(row);
  const laterRows = [...later].map(row);
  const inlineRows = inline.map((body, index) => ({
    file: `<inline script ${index + 1}>`,
    raw: Buffer.byteLength(body),
    gzip: gzip(body),
  }));
  const sum = (rows, key) => rows.reduce((total, item) => total + item[key], 0);

  const assets = join(dist, '_assets');
  const chunks = readdirSync(assets).filter((name) => name.endsWith('.js'));
  const holding = (marker) =>
    chunks.filter((name) => readFileSync(join(assets, name), 'utf8').includes(marker));

  return {
    page: relative(dist, pageFile).replaceAll('\\', '/'),
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
