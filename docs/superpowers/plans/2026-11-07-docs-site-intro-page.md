# WaveUI intro page (brudvik.com/waveui) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `brudvik.com/waveui` to the homepage repository as a normal brudvik.com page that introduces WaveUI and opens the docs app, and add the rewrite that serves the app under `/waveui/docs`.

**Architecture:** One plain static page in the existing site style (shared `site.css`, `site.js`, palette script, header, footer), a rewrite in the homepage's `vercel.json`, and the usual metadata, sitemap, Open Graph image and tests. No build step.

**Tech Stack:** Plain HTML, CSS and JavaScript modules, Vercel static hosting, `node --test` for unit tests, Playwright for end-to-end tests.

**Spec:** `docs/superpowers/specs/2026-11-07-docs-site-design.md` in the WaveUI repository (section "Intro page details"), and the homepage's own `docs/superpowers/specs/2026-10-26-bergen-redesign-design.md`, which this page obeys. Work happens in `C:\code\projects\homepage-brudvik-com`. The app itself is the other plan, `2026-11-07-docs-site-app.md`.

## Global Constraints

- Plain HTML, CSS and JavaScript: no framework, build step, CMS, analytics or new pages beyond `/waveui`.
- Same shared header ("Morten Brudvik" and the live Bergen readout) and footer as the other pages; Schibsted Grotesk self-hosted; the daylight palette via the existing inline palette script; works with JavaScript off (day palette).
- Keep the page's `<title>`, meta description, canonical, Open Graph and Twitter tags, JSON-LD, a `sitemap.xml` entry and an Open Graph image, as every page has.
- WCAG AA in every palette; `prefers-reduced-motion` honoured; works at phone width with 16px side padding and no horizontal scroll.
- Anti-goals of the homepage spec apply: nothing that reads as AI-made (gradient blobs, glassmorphism cards, numbered sections, emoji, all-caps monospace labels); motion only in the one interaction.
- The one interaction is the transition into the app: a cross-page view transition where supported, a plain link otherwise.
- The app lives under `/waveui/docs`; a single rewrite `/waveui/docs/:path*` forwards to the app's Vercel project (placeholder `WAVEUI_DOCS_URL` until Morten creates it). The homepage's global headers stay.
- Facts on the page (version, component count) must match the library; no number is invented.
- Commit messages in this repository's style; no AI attribution.

## Review Focus

1. The rewrite sends `/waveui/docs/...` to itself or to a wrong host, or swallows `/waveui` (the intro page) [Task 4].
2. JavaScript off, or the clipboard unavailable: the install line still readable, the copy button hides or degrades [Task 5].
3. Stale facts: the homepage list says "65 accessible components" and the library has 80 [Task 3].
4. Browsers without cross-document view transitions: the button must still navigate [Task 5].
5. Invalid or inconsistent JSON-LD (version differing from the visible version) [Task 1].

## File Structure

- Create: `public/waveui/index.html`, `public/og/waveui.png` (generated), `tests/unit/sitemap.test.js`, `tests/unit/rewrites.test.js`, `tests/e2e/waveui.spec.js`
- Modify: `vercel.json` (rewrite), `public/sitemap.xml`, `public/index.html` (the waveui row), `generate-og-images.py`, `tests/unit/jsonld.test.js`

---

### Task 1: The page

**Files:**
- Create: `public/waveui/index.html`; Modify: `tests/unit/jsonld.test.js`

**Interfaces:**
- Produces: the page at `/waveui`. Sections, in order: skip link and shared header; hero (meta line `v<version> · React 19 · 80 components · MIT`, `h1`, lede, actions: primary "Open the components" to `/waveui/docs/components`, then GitHub, npm, Changelog (`/waveui/docs/changelog`), a copyable `npm i @mortenbrudvik/waveui` install line, facts line); a block of three strengths (Windows feel, three themes with right to left, small by design: Button about 4 KB gzipped); "Also" links block; shared footer with page links.

- [ ] **Step 1: Failing test in `jsonld.test.js`:** `waveui page has a SoftwareApplication with the repository, the package, a license and a softwareVersion equal to the version in the visible meta line`; `the page has one h1, a canonical https://brudvik.com/waveui and og:image https://brudvik.com/og/waveui.png`.
- [ ] **Step 2: Run `npm test`, see it fail** (no page).
- [ ] **Step 3: Write the page by copying the head, palette script, header, footer and button styles from `public/loadstone/index.html`;** copy is plain and specific, sentence case, no marketing filler; the version and counts are read from the library's `package.json` and stories count (80) at the time of writing and stated in the commit message.
- [ ] **Step 4: Run `npm test`, see it pass. Commit** `Add the WaveUI intro page`.

### Task 2: Open Graph image

**Files:**
- Modify: `generate-og-images.py`; Create: `public/og/waveui.png`

- [ ] **Step 1: Add a `waveui` entry to the script** (night palette, headline and one supporting line taken from the page, 1200x630), update its docstring list.
- [ ] **Step 2: Run `python3 generate-og-images.py`;** check the PNG is 1200x630 and the text is legible by opening it. **Step 3: Commit** `Add the WaveUI Open Graph image`.

### Task 3: Sitemap and the homepage row

**Files:**
- Modify: `public/sitemap.xml`, `public/index.html`; Create: `tests/unit/sitemap.test.js`

- [ ] **Step 1: Failing test `every indexable page is in sitemap.xml and every sitemap URL has a file`** (walk `public/` for `.html` without `noindex`, compare to the `<loc>` list; clean URLs).
- [ ] **Step 2: Run, fail.** **Step 3:** add `https://brudvik.com/waveui` (priority 0.8, today's date) to the sitemap; on the home page change the waveui row to say "80 accessible components" (matching the library) and add an "Intro" link to `/waveui` beside GitHub and npm.
- [ ] **Step 4: Run, pass. Commit** `Add /waveui to the sitemap and fix the component count on the home page`.

### Task 4: The rewrite

**Files:**
- Modify: `vercel.json`; Create: `tests/unit/rewrites.test.js`

**Interfaces:**
- Produces: `rewrites: [{ "source": "/waveui/docs/:path*", "destination": "WAVEUI_DOCS_URL/waveui/docs/:path*" }]` in `vercel.json`, with `WAVEUI_DOCS_URL` replaced by the app's real URL when it exists.

- [ ] **Step 1: Failing tests:** `vercel.json has exactly one rewrite and its source is /waveui/docs/:path*`; `the destination host differs from brudvik.com and keeps the same path`; `no rewrite source matches /waveui (the intro page stays here)`; `the existing headers block is unchanged` (compare to a literal copy).
- [ ] **Step 2: Run, fail. Step 3: Add the rewrite** with the placeholder host and a comment in the commit body that it is replaced once the Vercel project exists. **Step 4: pass. Commit** `Forward /waveui/docs to the docs app`.

### Task 5: Behaviour and end-to-end checks

**Files:**
- Create: `tests/e2e/waveui.spec.js`; Modify: `public/waveui/index.html` (the transition CSS and the copy button script, reusing the existing `data-copy` handler from `site.js`)

- [ ] **Step 1: Failing specs** (`mockWeather` and `noHorizontalScroll` from `fixtures.js`): `header shows the Bergen readout`; `the four links point to GitHub, npm, the changelog and the components index`; `the install line is selectable text and Copy puts it on the clipboard`; `with JavaScript disabled the page content and links are all present`; `with the clipboard API missing the copy button is hidden, the text remains`; `no horizontal scroll at 375px`; `Tab order starts with the skip link and reaches Open the components first`; `the page declares @view-transition navigation auto` (computed from the stylesheet) and `prefers-reduced-motion: reduce` turns the transition off.
- [ ] **Step 2: Run `npm run test:e2e -- waveui`, fail. Step 3: Implement the missing behaviour.** The matching `@view-transition` rule and the window's `view-transition-name` live in the app's layout (the other plan). **Step 4: pass. Commit** `Test the WaveUI intro page in the browser`.

### Task 6: Preview verification (by hand)

- [ ] **Step 1: Deploy a Vercel preview of this branch with the real `WAVEUI_DOCS_URL`;** check `/waveui` and `/waveui/docs/components/button` load, that the app's assets resolve under `/waveui/docs/_assets/`, and that response headers include the homepage's.
- [ ] **Step 2: Run Lighthouse (mobile) on `/waveui`;** record the scores in the pull request. **Step 3:** merge to `main` only after the app is live and these pass.
