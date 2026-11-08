/**
 * `scripts/measure-page.mjs` on a small fixture dist: the exact JSON `measurePage` gives (a literal
 * pin, so a change of the measuring or of the HTML parse that moves a number or drops a script
 * shows), and the script and modulepreload addresses the parse accepts (single quotes, either
 * attribute order).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { measurePage, pageJsReport } from '../measure-page.mjs';

const A = '/waveui/docs/_assets';

let dist;

const FILES = {
  // Static import of dep.js and a dynamic import of lazy.js.
  'entry.js': 'import { dep } from "./dep.js";\nexport const entry = dep + 1;\nimport("./lazy.js");\n',
  'dep.js': 'export const dep = 41;\n',
  'lazy.js': 'export const lazy = "only when asked";\n',
  'island.js': 'export default function Island() { return null; }\n',
  'renderer.js': 'export default () => "renderer";\n',
  // Holds the markers of React's core and of react-dom's client.
  'react.js':
    'const x = {}; x.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=1; export default x;\n',
  'dom.js': 'export const rendererPackageName = "react-dom";\n',
};

beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'wave-measure-'));
  mkdirSync(join(dist, '_assets'));
  for (const [name, code] of Object.entries(FILES)) writeFileSync(join(dist, '_assets', name), code);
});

afterEach(() => {
  rmSync(dist, { recursive: true, force: true });
});

const PAGE = `<!DOCTYPE html><html lang="en" dir="ltr"><head>
<script>document.documentElement.dataset.x = "1";</script>
<script type="module" src="${A}/entry.js"></script>
<link rel="modulepreload" href="${A}/dep.js">
<link rel="stylesheet" href="${A}/a.css">
</head><body>
<astro-island uid="1" component-url="${A}/island.js" renderer-url="${A}/renderer.js" props="{}"></astro-island>
<script>
</script>
</body></html>`;

describe('measurePage', () => {
  it('gives this JSON for a fixture page (the pinned output of the measuring)', () => {
    writeFileSync(join(dist, 'page.html'), PAGE);
    expect(measurePage(join(dist, 'page.html'), dist)).toEqual(EXPECTED);
  });
});

/**
 * Captured from the measuring as it was before the HTML parse accepted single quotes and either
 * attribute order, and checked by hand: the first load is the entry and its static import
 * (`dep.js`), the island's component and renderer, plus the inline script (258 + 51 = 309 B gzip);
 * `lazy.js` is reachable only through `import()`; the whitespace-only inline script counts for
 * nothing.
 */
const EXPECTED = {
  page: 'page.html',
  inline: [{ file: '<inline script 1>', raw: 41, gzip: 51 }],
  firstLoad: [
    { file: '_assets/entry.js', raw: 83, gzip: 92 },
    { file: '_assets/dep.js', raw: 23, gzip: 43 },
    { file: '_assets/island.js', raw: 50, gzip: 70 },
    { file: '_assets/renderer.js', raw: 33, gzip: 53 },
  ],
  later: [{ file: '_assets/lazy.js', raw: 39, gzip: 59 }],
  totals: {
    inlineGzip: 51,
    firstLoadGzip: 309,
    firstLoadRaw: 230,
    laterGzip: 59,
    everythingGzip: 368,
  },
  reactCoreChunks: ['react.js'],
  reactDomClientChunks: ['dom.js'],
};
