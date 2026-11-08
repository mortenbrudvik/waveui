#!/usr/bin/env node
/**
 * The end-to-end tests' server: the built site (`website/dist`) served as production serves it, so
 * a page, link or asset that works on `astro preview` but not behind the deployment's rewrites
 * fails a test (the plan's Review Focus #1). Two HTTP servers run in one process:
 *
 * - **The app server** stands for the site's own Vercel project. It reads `website/vercel.json`
 *   when it starts and implements it literally, in the order of the routes Vercel builds from it
 *   (`getTransformedRoutes` of `@vercel/routing-utils` 6): the redirects of `cleanUrls` (`/x.html`,
 *   `/x/index` and `/x/index.html` to `/x`) and of `trailingSlash: false` (`/x/` to `/x`), both
 *   308 and without the `headers` (a redirect route ends the routing before them); then the
 *   `headers` whose `source` matches the incoming path, on every other response; then the file at
 *   the incoming path; then the first matching `rewrites` rule and the file at its destination.
 *   With `cleanUrls` a path `/x` is served from `x.html`; a directory from its `index.html`.
 *   Anything else is a 404. A key of `vercel.json` it does not implement stops it, so the file
 *   cannot grow a rule the tests silently ignore.
 * - **The front server** stands for the homepage's project at brudvik.com
 *   ({@link HOMEPAGE_ROUTING}): first its own redirects, `cleanUrls` and `trailingSlash: false`
 *   (Vercel runs redirects before rewrites, so `/waveui/docs/components/button/` gets a 308 to
 *   `/waveui/docs/components/button` from the homepage before its rewrite is tried); then its one
 *   rewrite, which sends `/waveui/docs/:path*` to the app, path unchanged; `/waveui` answers with
 *   a stub of the intro page (the title bar's Close goes there); every other path is a 404. It
 *   does not emulate the homepage's own `headers` (its global security headers equal the app's,
 *   and the tests check the app's). The tests talk to the front server only.
 *
 * Source patterns are the subset of path-to-regexp that `vercel.json` uses: literal text, named
 * parameters `:name` with an optional `(regex)` and modifier `?`, `*` or `+` (a `/` before a `?` or
 * `*` parameter is optional with it), and unnamed `(regex)` groups. Matching is case-sensitive and
 * strict (no optional trailing `/`), as Vercel compiles sources (path-to-regexp 6.1 with
 * `strict: true, sensitive: true`): `/waveui/docs/:path*` matches `/waveui/docs` and
 * `/waveui/docs/components/button`, never `/waveui/docs/` or `/waveui/docs/components/button/`.
 *
 * Usage: node e2e/server.mjs [--port 4400] [--host 127.0.0.1] [--dist <dir>] [--config <file>]
 */
import { readFileSync, statSync } from 'node:fs';
import { Agent, createServer, request } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = fileURLToPath(new URL('..', import.meta.url));

/** The homepage's rewrite of the app's prefix, and the intro page Close links to. */
export const DOCS_PREFIX = '/waveui/docs';
export const INTRO_PATH = '/waveui';

/** What the stub of the intro page holds, so a test can tell it from a 404 or an app page. */
export const INTRO_STUB_MARKER = 'data-e2e-intro-stub';

const IMPLEMENTED_KEYS = new Set(['$schema', 'cleanUrls', 'trailingSlash', 'rewrites', 'headers']);

/** The keys this server implements in a rule of `rewrites`, of `headers`, and in a header. */
const RULE_KEYS = {
  rewrites: new Set(['source', 'destination']),
  headers: new Set(['source', 'headers']),
  header: new Set(['key', 'value']),
};

/**
 * The homepage's routing settings that touch the app's addresses, copied from the homepage
 * repository's `vercel.json` (`homepage-brudvik-com/vercel.json`: `"cleanUrls": true,
 * "trailingSlash": false`, read 2026-11-08). They are a copy because CI has no checkout of that
 * repository; the spec has the two projects' trailing-slash and clean-URL settings agree, so a
 * change there must be made here too (and in `website/vercel.json`).
 */
export const HOMEPAGE_ROUTING = { cleanUrls: true, trailingSlash: false };

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  // Vercel's types for static files: scripts are `application/javascript`.
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/** Vercel's `Cache-Control` of a static file, which a `headers` rule may replace. */
const DEFAULT_CACHE_CONTROL = 'public, max-age=0, must-revalidate';

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The index of the `)` that closes the `(` at `start` in `source`. */
function closingParen(source, start) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') {
      index += 1;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error(`unbalanced "(" in the pattern ${source}`);
}

/** A group's own regex: capturing groups inside it would shift the parameters, as in path-to-regexp. */
function checkGroup(group, source) {
  if (/(^|[^\\])\((?!\?)/.test(group)) {
    throw new Error(`capturing group inside a parameter of ${source}: use (?:…)`);
  }
  return group;
}

/**
 * Compiles a `source` of `vercel.json` to `{ regex, names }`; `names[i]` is the parameter the
 * `i + 1`th capture fills (an unnamed group is named by its index, `"0"`, `"1"`, …).
 */
export function compileSource(source) {
  if (!source.startsWith('/')) throw new Error(`a source must start with "/": ${source}`);
  let pattern = '';
  const names = [];
  let unnamed = 0;
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === ':') {
      const name = /^[A-Za-z0-9_]+/.exec(source.slice(index + 1))?.[0];
      if (!name) throw new Error(`a ":" without a parameter name in ${source}`);
      index += 1 + name.length;
      let group = '[^/]+?';
      if (source[index] === '(') {
        const end = closingParen(source, index);
        group = checkGroup(source.slice(index + 1, end), source);
        index = end + 1;
      }
      const modifier = '?*+'.includes(source[index] ?? 'x') ? source[index++] : '';
      const repeated = `(?:${group})(?:/(?:${group}))*`;
      const prefixed = pattern.endsWith('/');
      if (prefixed && (modifier === '?' || modifier === '*')) pattern = pattern.slice(0, -1);
      if (modifier === '') pattern += `(${group})`;
      else if (modifier === '+') pattern += `(${repeated})`;
      else if (modifier === '?') pattern += prefixed ? `(?:/(${group}))?` : `(${group})?`;
      else pattern += prefixed ? `(?:/(${repeated}))?` : `(${repeated})?`;
      names.push(name);
    } else if (char === '(') {
      const end = closingParen(source, index);
      pattern += `(${checkGroup(source.slice(index + 1, end), source)})`;
      names.push(String(unnamed));
      unnamed += 1;
      index = end + 1;
    } else {
      pattern += escapeRegExp(char);
      index += 1;
    }
  }
  return { regex: new RegExp(`^${pattern}$`), names };
}

/** The parameters of `path` under a compiled source, or `null` when it does not match. */
export function matchSource({ regex, names }, path) {
  const match = regex.exec(path);
  if (!match) return null;
  return Object.fromEntries(names.map((name, index) => [name, match[index + 1]]));
}

/** A rewrite's `destination` with its `:name` parameters filled; an empty result is `/`. */
export function fillDestination(destination, params) {
  const filled = destination.replace(/:([A-Za-z0-9_]+)[?*+]?/g, (_, name) => {
    if (!(name in params))
      throw new Error(`the destination ${destination} names :${name}, which its source does not`);
    return params[name] ?? '';
  });
  return filled === '' ? '/' : filled.replace(/\/{2,}/g, '/');
}

/** Throws when `item` (a rule of `vercel.json`) has a key this server does not implement. */
function checkRuleKeys(file, where, item, allowed) {
  for (const key of Object.keys(item ?? {})) {
    if (!allowed.has(key)) {
      throw new Error(
        `${file}: the end-to-end server does not implement "${key}" in ${where}; teach website/e2e/server.mjs what Vercel does with it`,
      );
    }
  }
}

/**
 * Reads and checks `vercel.json`: every key, at the top and in each rule (`has`, `missing`,
 * `statusCode`, … are refused), must be one this server implements, and each rule's pattern
 * compiles.
 */
export function loadVercelConfig(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  for (const key of Object.keys(raw)) {
    if (!IMPLEMENTED_KEYS.has(key)) {
      throw new Error(
        `${file}: the end-to-end server does not implement "${key}"; teach website/e2e/server.mjs what Vercel does with it`,
      );
    }
  }
  for (const rule of raw.rewrites ?? []) checkRuleKeys(file, 'a rewrite', rule, RULE_KEYS.rewrites);
  for (const rule of raw.headers ?? []) {
    checkRuleKeys(file, 'a headers rule', rule, RULE_KEYS.headers);
    for (const header of rule.headers ?? []) {
      checkRuleKeys(file, 'a header', header, RULE_KEYS.header);
    }
  }
  const rewrites = (raw.rewrites ?? []).map((rule) => ({
    destination: rule.destination,
    compiled: compileSource(rule.source),
  }));
  for (const rule of rewrites) {
    if (/^[a-z]+:\/\//i.test(rule.destination)) {
      throw new Error(`${file}: external rewrite destinations are not implemented`);
    }
  }
  const headers = (raw.headers ?? []).map((rule) => ({
    compiled: compileSource(rule.source),
    headers: rule.headers.map(({ key, value }) => [String(key).toLowerCase(), String(value)]),
  }));
  return {
    cleanUrls: raw.cleanUrls === true,
    trailingSlash: raw.trailingSlash,
    rewrites,
    headers,
  };
}

/** The redirect Vercel's `cleanUrls` gives a path (`/x.html`, `/x/index`, `/x/index.html`). */
export function cleanUrlRedirect(path) {
  const index = /^\/(?:(.+)\/)?index(?:\.html)?\/?$/.exec(path);
  if (index) return `/${index[1] ?? ''}`;
  const html = /^\/(.*)\.html\/?$/.exec(path);
  return html ? `/${html[1]}` : null;
}

/** The redirect of `trailingSlash: false`: a path that ends in `/` (but `/` itself). */
export function trailingSlashRedirect(path) {
  const match = /^\/(.*)\/$/.exec(path);
  return match ? `/${match[1]}` : null;
}

/** The 308 target the redirects of `cleanUrls` and `trailingSlash: false` give `path`, or `null`. */
function routingRedirect({ cleanUrls, trailingSlash }, path) {
  return (
    (cleanUrls ? cleanUrlRedirect(path) : null) ??
    (trailingSlash === false ? trailingSlashRedirect(path) : null)
  );
}

/** The file of `dist` that serves `path`, or `null`. */
function lookup(dist, path, cleanUrls) {
  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.split('/').includes('..')) return null;
  const base = resolve(dist);
  const candidates = decoded.endsWith('/')
    ? [join(decoded, 'index.html')]
    : [decoded, ...(cleanUrls ? [`${decoded}.html`] : []), join(decoded, 'index.html')];
  for (const candidate of candidates) {
    const file = resolve(base, `.${sep}${candidate}`);
    if (file !== base && !file.startsWith(base + sep)) continue;
    try {
      if (statSync(file).isFile()) return file;
    } catch {
      // Not there: the next candidate.
    }
  }
  return null;
}

function send(res, method, status, headers, body) {
  res.writeHead(status, { ...headers, 'content-length': Buffer.byteLength(body) });
  res.end(method === 'HEAD' ? undefined : body);
}

/** The app server's request handler: `dist` served as `config` (from `loadVercelConfig`) says. */
export function createAppHandler({ dist, config }) {
  return (req, res) => {
    const url = new URL(req.url ?? '/', 'http://app');
    const path = url.pathname;
    const method = req.method ?? 'GET';
    const redirect = routingRedirect(config, path);
    if (redirect !== null) {
      send(res, method, 308, { location: `${redirect}${url.search}` }, '');
      return;
    }

    const headers = { 'cache-control': DEFAULT_CACHE_CONTROL };
    for (const rule of config.headers) {
      if (matchSource(rule.compiled, path)) {
        for (const [key, value] of rule.headers) headers[key] = value;
      }
    }
    if (method !== 'GET' && method !== 'HEAD') {
      send(res, method, 405, { ...headers, allow: 'GET, HEAD' }, 'Method not allowed');
      return;
    }

    let file = lookup(dist, path, config.cleanUrls);
    if (!file) {
      for (const rule of config.rewrites) {
        const params = matchSource(rule.compiled, path);
        if (params) {
          file = lookup(dist, fillDestination(rule.destination, params), config.cleanUrls);
          break;
        }
      }
    }
    if (!file) {
      send(
        res,
        method,
        404,
        { ...headers, 'content-type': 'text/plain; charset=utf-8' },
        'Not found',
      );
      return;
    }
    const type = CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    send(res, method, 200, { ...headers, 'content-type': type }, readFileSync(file));
  };
}

const INTRO_STUB = `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title>WaveUI</title></head><body ${INTRO_STUB_MARKER}><h1>WaveUI (the intro page stub of the end-to-end server)</h1><p><a href="${DOCS_PREFIX}">Open the docs</a></p></body></html>`;

/** Headers of one connection, which a proxy does not pass on. */
function withoutHopHeaders(headers) {
  const rest = { ...headers };
  for (const name of ['connection', 'keep-alive', 'proxy-connection']) delete rest[name];
  return rest;
}

/**
 * The front server's handler: the homepage's redirects ({@link HOMEPAGE_ROUTING}), then its one
 * rewrite to the app at `appOrigin`, and the stub of the intro page.
 */
export function createFrontHandler({ appOrigin }) {
  const rewrite = compileSource(`${DOCS_PREFIX}/:path*`);
  const app = new URL(appOrigin);
  // Kept-alive connections, a few at a time: a burst of new connections (a crawl's hundreds of
  // requests) overflows the app server's accept queue on Windows (ECONNREFUSED).
  const agent = new Agent({ keepAlive: true, maxSockets: 16 });
  return (req, res) => {
    const url = new URL(req.url ?? '/', 'http://front');
    const path = url.pathname;
    const redirect = routingRedirect(HOMEPAGE_ROUTING, path);
    if (redirect !== null) {
      send(res, req.method ?? 'GET', 308, { location: `${redirect}${url.search}` }, '');
      return;
    }
    if (matchSource(rewrite, path)) {
      const upstream = request(
        {
          agent,
          hostname: app.hostname,
          port: app.port,
          method: req.method,
          path: req.url,
          headers: { ...withoutHopHeaders(req.headers), host: app.host },
        },
        (response) => {
          res.writeHead(response.statusCode ?? 502, withoutHopHeaders(response.headers));
          response.pipe(res);
        },
      );
      upstream.on('error', (error) => {
        res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(`app server error: ${error.message}`);
      });
      req.pipe(upstream);
      return;
    }
    if (path === INTRO_PATH) {
      send(
        res,
        req.method ?? 'GET',
        200,
        { 'content-type': 'text/html; charset=utf-8' },
        INTRO_STUB,
      );
      return;
    }
    send(
      res,
      req.method ?? 'GET',
      404,
      { 'content-type': 'text/plain; charset=utf-8' },
      'Not found',
    );
  };
}

const listen = (server, port, host) =>
  new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => done(server.address()));
  });

/** Starts both servers; resolves to the front server's origin and a `close()`. */
export async function startServers({
  port = 4400,
  host = '127.0.0.1',
  dist = join(siteRoot, 'dist'),
  configFile = join(siteRoot, 'vercel.json'),
} = {}) {
  try {
    statSync(join(dist, 'index.html'));
  } catch {
    throw new Error(`${dist} holds no build: run npm run site:build first`);
  }
  const config = loadVercelConfig(configFile);
  const appServer = createServer(createAppHandler({ dist, config }));
  const appAddress = await listen(appServer, 0, host);
  const appOrigin = `http://${host}:${appAddress.port}`;
  const frontServer = createServer(createFrontHandler({ appOrigin }));
  const frontAddress = await listen(frontServer, port, host);
  const origin = `http://${host}:${frontAddress.port}`;
  const close = () =>
    Promise.all(
      [frontServer, appServer].map(
        (server) => new Promise((done) => server.close(() => done(undefined))),
      ),
    );
  return { origin, appOrigin, close };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const option = (name) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 ? process.argv[at + 1] : undefined;
  };
  startServers({
    port: Number(option('port') ?? 4400),
    host: option('host') ?? '127.0.0.1',
    dist: option('dist') ? resolve(option('dist')) : undefined,
    configFile: option('config') ? resolve(option('config')) : undefined,
  }).then(
    ({ origin, appOrigin, close }) => {
      console.log(`e2e server: ${origin}${DOCS_PREFIX} (app ${appOrigin}, from vercel.json)`);
      for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, () => close().then(() => process.exit(0)));
      }
    },
    (error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
