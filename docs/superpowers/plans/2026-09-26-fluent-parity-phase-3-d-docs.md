# WaveUI 0.8.0 Phase 3 — DOCS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document Phase 3 (0.8.0) — stable class names, rich toasts and the toaster handle, MessageBar parts and reflow, the color parts and the composable ColorPicker, Tree multi-select and row content — in the CHANGELOG, README, CLAUDE.md, the design and testing guides, the roadmap and the Fluent comparison guide, against the final API of wave C.

**Architecture:** Wave D runs after INTEGRATION on the final branch. Each task drafts its text from the spec (given in full below), confirms every name, default and warning it states against the code and its JSDoc with grep before it commits, and verifies anchors with a GitHub-slug link checker that also catches links re-pointed by a repeated heading. Sizes are measured with scripts that reproduce the 0.7.0 methods exactly (CHANGELOG: app-mode Vite builds; comparison guide: esbuild), with 0.7.0 taken from its npm package.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 (`cn` = clsx + tailwind-merge), Vitest + React Testing Library + jsdom + vitest-axe, Storybook 10

**Spec:** `docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md` — §5.1–§5.5 (CHANGELOG, README, CLAUDE.md, guides, ROADMAP), D8 (the stability promise of the class names), §6.5 (the documentation items of the definition of done) and the "Docs" line of every item in §2. Task D6 (`docs/FLUENT-UI-COMPARISON.md`, added to `main` at b02eaf3 after the spec was approved) is a plan addition: record it as a spec §10 note.

**Index:** `docs/superpowers/plans/2026-09-26-fluent-parity-phase-3.md` (wave order, entry conditions, cross-package contract, final gate).

**Commits:** one per task. When packages run in parallel in one checkout, only the lead runs git write commands (spec §0.2 rule 6): a package agent stops at the commit step and reports its file list.

## Global Constraints

- Toolchain: Node `^22.22.2 || ^24.15.0 || >=26.0.0`, npm >= 11.11 (devEngines). No new runtime dependency (spec D30).
- Branch and worktree: `feat/fluent-parity-phase-3` in `.claude/worktrees/fluent-parity-phase-3`. Never a bare `git stash`; never `checkout -b` in the main checkout.
- Commits: conventional-commit subjects (`feat(feedback): …`); no AI attribution trailer; one commit per task.
- File ownership (spec §3): only your package's files. `src/lib/classNames.ts` and `MessageBar.status.tsx` are read-only after wave A; the barrels and `src/index.ts` belong to INTEGRATION (wave C), except the registry export of Task A1.
- Conventions (CLAUDE.md, binding): C-REF (ref in props; `displayName` on every component and part), C-COMPOSE (consumer handlers first; `cn(<stable class>, <internal>, className)`; ignore events whose target is not DOM-inside `currentTarget`), C-CLASS (enumerated `data-*` always rendered, boolean ones present or absent, before `{...rest}`), C-TOKENS (theme tokens only; runtime colors only as inline custom-property values marked `// wave-allow-color: <reason>`), C-LOGICAL (logical utilities; the `wave-rtl:` variant only; horizontal arrows through `getArrowIntent`), C-FOCUS, C-MOTION (every `transition*`/`animate-*` string has a same-kind `motion-reduce:` variant; no component ships enter or exit motion, D29), C-DISABLED, C-NAMING, C-CONTEXT, C-MEMO, C-IDS, C-SLOTS, C-BUTTON-TYPE, C-NATIVE, C-ROUTING, C-FORMS, C-POPUPS, C-COMPOUND, C-PURE, C-HOOKS, C-DEV (`warnOnce` from effects; dotted keys such as `Toast.Title:unscanned`), C-DOCS, C-STORIES.
- Stable classes (spec §1.2): every element of a registered part carries exactly its Appendix A class, first in its `cn()` (or in `renderSlot`'s base classes), written as a literal member access (`toastTitleClassNames.root`); no state classes.
- Never write a Tailwind utility name as a bare word in comments or strings under `src/components` or `src/lib` (the CSS build fails on it).
- Tests: a test fails before its code exists (TDD); clean output (no act() warnings; every `[WaveUI]` warning asserted); never hard-code test counts; query by role and accessible name.
- Per task: the focused Vitest runs, `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, ESLint on the touched files with `--max-warnings 0`, and the conventions and stories gate filters for the touched components and stories.

DOCS-specific:

- DOCS owns `CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/WAVE-UI-GUIDE.md`, `docs/testing-best-practices.md`, `docs/ROADMAP.md` and `docs/FLUENT-UI-COMPARISON.md`, nothing else. Where the code contradicts the text below, the code and its JSDoc decide and the text changes; a code defect found on the way goes to the lead and is not fixed here. (For docs, the TDD, tsc and ESLint lines above become the verification steps of each task.)
- Formatting: `npm run format:check` does not cover Markdown. `README.md` is Prettier-clean: run `npx prettier --write README.md` after editing it (that re-aligns its tables) and `npx prettier --check README.md`. Never run Prettier on the other Markdown files: they are not Prettier-formatted, and it would rewrite them.
- Links: every `](#…)` and `](file.md#…)` link passes `doclinks.cjs` (below). GitHub numbers a repeated heading in document order (`#changed`, `#changed-1`, …), so a heading added to a newer section re-points older links without breaking them.
- Wave D runs after INTEGRATION on the final API. The text below is drafted from the spec; each task's grep step confirms every name, default and warning key it states before the commit, and the wave D report lists every place where the text had to follow the code.
- Temporary tools live in `node_modules/.cache/wave-docs/` (git-ignored, not linted, not formatted); the temporary example modules of Task D2 (`src/__tests__/readme-example-*.check.tsx`) are deleted before its commit. `git status --short` before each commit shows only the task's Markdown files.

## Review Focus

1. **Older CHANGELOG anchors that still resolve.** A `### Added`, `#### Behaviour`, `#### Types`, `### Deprecated` … heading in the 0.8.0 section takes over the unnumbered slug, so an older `](#behaviour)` silently jumps to 0.8.0 instead of breaking. Expected: every link in the 0.7.0, 0.6.0 and 0.5.0 sections still reaches its own version's heading (renumbered once, by script; `doclinks.cjs` rule 2 fails a link that lands in another version's section) → Task D1.
2. **README links into the CHANGELOG.** `README.md` links `CHANGELOG.md#changed` (the 0.7.0 "Changed" section) and `#changed-1` (0.6.0); the Dialog fix branch (`fix/dialog-surface-margin`) renumbered the CHANGELOG but not these links, and this phase's `### Changed` has the same effect. Expected: each "Upgrading from 0.x" link reaches that version's Changed section (`#changed` for 0.8.0, `#changed-1` for 0.7.0, `#changed-2` for 0.6.0), checked across files by `doclinks.cjs` → Task D2.
3. **The Dialog fix merged first, or not.** Expected: one coherent 0.8.0 section either way: one `## [0.8.0]`, each heading once, one Upgrading list numbered from 1 with the Dialog item first when it exists, and the Dialog's DOM entry kept first in its subsection (`changelog-check.cjs`) → Task D1.
4. **Examples and statements that no longer match the code** (a README example that does not compile against the final API; a default or warning key renamed in wave B or C; `TreeLabels` present or absent after the VoiceOver spike). Expected: the docs follow the code and its JSDoc; the new README examples are type-checked with the dev program (`readme-examples.cjs`), and every task greps the names it states → Task D2.
5. **Size numbers from another method.** A lib-mode Vite build keeps the whitespace of ES output and reads about 30% larger than the 0.7.0 entry's numbers. Expected: both CHANGELOG columns come from the same app-mode script, 0.7.0 from its npm package, and the script reproduces the 0.7.0 entry's `dist/styles.css` (56.2 KiB) and Button-only (10.9 KiB) numbers before 0.8.0 is measured → Task D1 (Task D6 has the same reproduction check for the comparison guide's esbuild probes: 39.0 KiB for Button).

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `CHANGELOG.md` | The `## [0.8.0] - Unreleased` section (created, or merged into the one the Dialog fix opened); the anchors of older sections renumbered | D1 |
| `README.md` | Component tables, "Styling hooks" (new), React Server Components, usage notes (Toasts rewritten; Message bars, Color and Trees new), value callbacks, composite controls, forms, slots, built-in text, keyboard, hooks, "Upgrading from 0.7" (new), CHANGELOG anchors | D2 |
| `CLAUDE.md` | Component count, the Phase 3 spec, architecture (new modules, `withPartClass`, `tabStop`, the three `src/lib` modules), C-CLASS, C-COMPOSE, Styling, Testing | D3 |
| `docs/WAVE-UI-GUIDE.md` | Pattern 10 (stable class names), the accessibility chapter (toasts, 2-D slider, checkbox tree, MessageBar naming), feedback patterns, catalog, file paths, cheat sheet, 1.0 notices | D4 |
| `docs/testing-best-practices.md` | The stable-class case of `testClassName`, recipes for toasts, the MessageBar reflow, the color parts and the cascade model, the repo-level suites | D4 |
| `docs/ROADMAP.md` | Status, the Phase 3 design link, the overview table, what the spec changed in Phase 3, P11-04, P13-01, P13-02, P13-03, P14-02, §8.1, §8.3, §8.5 | D5 |
| `docs/FLUENT-UI-COMPARISON.md` | Revision for 0.8.0: every Phase 3 gap moves from "not yet" to the component map; the WaveUI size column re-measured | D6 |
| `node_modules/.cache/wave-docs/*` | Temporary verification tools (not committed) | all |

## Shared verification tools

Every task uses some of these scripts. Save each one (with the Write tool) in `node_modules/.cache/wave-docs/` under the name given, the first time a task needs it; a later task that finds it missing (after `npm ci`, say) saves it again from here. Run them from the repository root in the Bash tool (Git Bash).

**Reading the replace instructions.** The tasks quote Markdown that itself contains code spans. Inside an inline code span of an instruction ("replace `…` with `…`"), `` \` `` stands for a literal backtick: type the backtick, not the backslash. Text in fenced blocks is literal as it stands.

### `doclinks.cjs` — anchor links as GitHub renders them

````js
// Checks the anchor links of Markdown files the way GitHub renders them.
// Usage: node node_modules/.cache/wave-docs/doclinks.cjs <file.md> [...more files]
// 1. Every `](#anchor)` and `](relative/file.md#anchor)` link must match a heading slug of its
//    target file (GitHub slugs: lower case, punctuation removed, spaces to hyphens; a repeated
//    slug gets `-1`, `-2`, … in document order).
// 2. A link into CHANGELOG.md whose heading name occurs in several version sections (`Changed`,
//    `Behaviour`, `Added`, …) must point into the right section: inside CHANGELOG.md, the section
//    that holds the link; from another file, a section whose version (`0.7.0`) appears on the
//    link's line. A heading added to a newer section shifts the numbers of every older one, so a
//    link that was not renumbered still resolves, to the newer section: rule 2 catches it.
const fs = require('fs');
const path = require('path');

const cache = new Map();
function parse(file) {
  if (cache.has(file)) return cache.get(file);
  const occurrences = new Map();
  const headings = new Map(); // slug -> { name, section }
  const names = new Map(); // name -> Set(section)
  let fence = false;
  let section = '';
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (!h) continue;
    const name = h[2].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '');
    if (h[1] === '##') section = name;
    const base = name
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
      .replace(/ /g, '-');
    let slug = base;
    while (occurrences.has(slug)) {
      occurrences.set(base, occurrences.get(base) + 1);
      slug = `${base}-${occurrences.get(base)}`;
    }
    occurrences.set(slug, 0);
    headings.set(slug, { name, section: h[1] === '##' ? name : section });
    if (!names.has(name)) names.set(name, new Set());
    names.get(name).add(h[1] === '##' ? name : section);
  }
  const result = { headings, names };
  cache.set(file, result);
  return result;
}

const version = (section) => (/\[(\d+\.\d+\.\d+)\]/.exec(section) ?? [])[1];
let links = 0;
const errors = [];
for (const file of process.argv.slice(2)) {
  const own = parse(file);
  let fence = false;
  let section = '';
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((raw, i) => {
      if (/^\s*(```|~~~)/.test(raw)) {
        fence = !fence;
        return;
      }
      if (fence) return;
      const h = /^(##)\s+(.*?)\s*$/.exec(raw);
      if (h) section = h[2].replace(/[`*]/g, '');
      const line = raw.replace(/`[^`]*`/g, '');
      for (const m of line.matchAll(/\]\(([^)\s#]*)#([^)\s]+)\)/g)) {
        const [, target, anchor] = m;
        if (/^[a-z]+:/i.test(target)) continue;
        links++;
        const where = `${file}:${i + 1}`;
        const targetFile = target ? path.resolve(path.dirname(file), target) : path.resolve(file);
        if (!fs.existsSync(targetFile)) {
          errors.push(`${where} ${target} does not exist`);
          continue;
        }
        const parsed = target ? parse(targetFile) : own;
        const heading = parsed.headings.get(anchor);
        if (!heading) {
          errors.push(`${where} ${target}#${anchor} matches no heading`);
          continue;
        }
        if (path.basename(targetFile) !== 'CHANGELOG.md') continue;
        if ((parsed.names.get(heading.name)?.size ?? 0) < 2) continue;
        if (!target || path.resolve(file) === targetFile) {
          if (heading.section !== section) {
            errors.push(
              `${where} #${anchor} is "${heading.name}" of "${heading.section}", not of this section "${section}"`,
            );
          }
        } else if (!raw.includes(version(heading.section) ?? '\u0000')) {
          errors.push(
            `${where} ${target}#${anchor} is "${heading.name}" of "${heading.section}", whose version this line does not name`,
          );
        }
      }
    });
}
for (const error of errors) console.log(error);
console.log(`${links} anchor links checked, ${errors.length} problems`);
process.exit(errors.length ? 1 : 0);
````

Checked while this plan was written: on the 0.7 docs it reports `93 anchor links checked, 0 problems`; on the Dialog branch's CHANGELOG with the issues-4-7 README it reports the two stale README links of Review Focus 2.

### `renumber.cjs` — shift the duplicate numbers of released sections

````js
// Shifts the GitHub duplicate numbers of CHANGELOG links in the released sections by one.
// Usage: node node_modules/.cache/wave-docs/renumber.cjs CHANGELOG.md added,behaviour,visual
// For each listed heading slug, every `](#slug)` becomes `](#slug-1)` and every `](#slug-N)`
// becomes `](#slug-(N+1))`, on the lines from the first `## [x.y.z]` heading that is not
// `## [0.8.0]` to the end of the file (the unreleased section is left alone). Run it once, for the
// heading names that the 0.8.0 section adds and that older sections also have.
const fs = require('fs');
const [file, list] = process.argv.slice(2);
if (!file || !list) {
  console.error('usage: node renumber.cjs <CHANGELOG.md> <slug>[,<slug>...]');
  process.exit(2);
}
const names = list.split(',').map((name) => name.trim()).filter(Boolean);
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(`\\]\\(#(${names.map(escape).join('|')})(?:-(\\d+))?\\)`, 'g');
const lines = fs.readFileSync(file, 'utf8').split('\n');
const start = lines.findIndex((line) => /^## \[(?!0\.8\.0\])/.test(line));
if (start === -1) {
  console.error('no released section found');
  process.exit(1);
}
let changed = 0;
for (let i = start; i < lines.length; i++) {
  lines[i] = lines[i].replace(pattern, (match, name, n) => {
    changed++;
    return `](#${name}-${n ? Number(n) + 1 : 1})`;
  });
}
fs.writeFileSync(file, lines.join('\n'));
console.log(`${changed} links renumbered from line ${start + 1}`);
````

### `changelog-check.cjs` — the shape of the 0.8.0 section

````js
// Checks the structure of the 0.8.0 section of CHANGELOG.md.
// Usage: node node_modules/.cache/wave-docs/changelog-check.cjs CHANGELOG.md
// - `## [0.8.0]` occurs once, as the first version section;
// - its headings are, in order: Upgrading from 0.7, Added, Changed, Behaviour, Visual,
//   DOM structure, Types, Deprecated, (Fixed,) Size;
// - its Upgrading list is numbered 1, 2, 3, … without gaps;
// - every gap id that Phase 3 closes or mitigates (spec §7) appears in it.
const fs = require('fs');
const text = fs.readFileSync(process.argv[2] ?? 'CHANGELOG.md', 'utf8');
const lines = text.split(/\r?\n/);
const errors = [];
const versions = lines.flatMap((line, i) => (/^## \[/.test(line) ? [{ line, i }] : []));
const own = versions.filter((v) => v.line.startsWith('## [0.8.0]'));
if (own.length !== 1) errors.push(`expected one "## [0.8.0]" heading, found ${own.length}`);
if (versions[0] && !versions[0].line.startsWith('## [0.8.0]')) {
  errors.push(`the first version section is "${versions[0].line}", not 0.8.0`);
}
const start = own[0]?.i ?? 0;
const end = versions.find((v) => v.i > start)?.i ?? lines.length;
const section = lines.slice(start, end);
const headings = section.filter((line) => /^#{3,4} /.test(line)).map((line) => line.trim());
const expected = [
  '### Upgrading from 0.7',
  '### Added',
  '### Changed',
  '#### Behaviour',
  '#### Visual',
  '#### DOM structure',
  '#### Types',
  '### Deprecated',
  '### Size',
];
const actual = headings.filter((h) => h !== '### Fixed');
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  errors.push(
    `headings of the 0.8.0 section:\n  ${headings.join('\n  ')}\nexpected:\n  ${expected.join('\n  ')} (and optionally ### Fixed before ### Size)`,
  );
}
const fixedAt = headings.indexOf('### Fixed');
if (fixedAt !== -1 && headings[fixedAt + 1] !== '### Size') errors.push('### Fixed must come right before ### Size');
const upgradeStart = section.findIndex((line) => line.trim() === '### Upgrading from 0.7');
const upgradeEnd = section.findIndex((line, i) => i > upgradeStart && /^#{2,4} /.test(line));
const numbers = section
  .slice(upgradeStart + 1, upgradeEnd === -1 ? undefined : upgradeEnd)
  .flatMap((line) => (/^(\d+)\. /.test(line) ? [Number(/^(\d+)\. /.exec(line)[1])] : []));
numbers.forEach((n, i) => {
  if (n !== i + 1) errors.push(`Upgrading item ${i + 1} is numbered ${n}`);
});
if (numbers.length === 0) errors.push('the Upgrading list is empty');
const body = section.join('\n');
const gaps = [
  'foundation-37', 'buttons-29', 'toast-1', 'toast-2', 'toasttrigger-1', 'toast-3', 'toaster-2',
  'toaster-5', 'messagebar-1', 'messagebar-2', 'messagebar-3', 'colorarea-1', 'colorslider-1',
  'colorpicker-1', 'alphaslider-1', 'colorpicker-2', 'colorpicker-3', 'tree-1', 'tree-2', 'tree-7',
  'tree-8',
];
for (const gap of gaps) {
  if (!body.includes(`\`${gap}\``)) errors.push(`gap id \`${gap}\` does not appear in the 0.8.0 section`);
}
for (const error of errors) console.log(error);
console.log(`0.8.0 section: ${headings.length} headings, ${numbers.length} upgrading items, ${errors.length} problems`);
process.exit(errors.length ? 1 : 0);
````

### `readme-examples.cjs` — type-check README examples

````js
// Type-checks README examples: writes every ```tsx block of the named sections to its own
// temporary module, src/__tests__/readme-example-<n>.check.tsx, importing from the entry
// ('../index') instead of '@mortenbrudvik/waveui', for `npx tsc -p tsconfig.dev.json --noEmit`.
// Usage (repository root):
//   node node_modules/.cache/wave-docs/readme-examples.cjs README.md "Toasts" "Trees" …
//   node node_modules/.cache/wave-docs/readme-examples.cjs --clean
// A block without an import statement is a fragment, not a module: it is listed and skipped.
const fs = require('fs');
const path = require('path');

const outIndex = process.argv.indexOf('--out');
const outDir = path.resolve(outIndex === -1 ? 'src/__tests__' : process.argv[outIndex + 1]);
const args = process.argv.slice(2).filter((arg, i, all) => arg !== '--out' && all[i - 1] !== '--out');
const isExample = (name) => /^readme-example-\d+\.check\.tsx$/.test(name);

if (args[0] === '--clean') {
  const removed = fs.readdirSync(outDir).filter(isExample);
  for (const name of removed) fs.rmSync(path.join(outDir, name));
  console.log(`removed ${removed.length} example files from ${outDir}`);
  process.exit(0);
}

const [file, ...sections] = args;
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
let written = 0;
for (const name of sections) {
  const start = lines.findIndex((line) => {
    const h = /^(#{2,6})\s+(.*?)\s*$/.exec(line);
    return h && h[2].replace(/`/g, '') === name;
  });
  if (start === -1) {
    console.log(`section "${name}" not found`);
    process.exitCode = 1;
    continue;
  }
  const level = /^(#+)/.exec(lines[start])[1].length;
  let end = lines.findIndex(
    (line, i) => i > start && /^(#+)\s/.test(line) && /^(#+)/.exec(line)[1].length <= level,
  );
  if (end === -1) end = lines.length;
  let block = null;
  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    if (block === null && /^\s*```tsx\s*$/.test(line)) {
      block = { from: i + 1, indent: /^(\s*)/.exec(line)[1].length, code: [] };
    } else if (block !== null && /^\s*```\s*$/.test(line)) {
      const code = block.code.map((l) => l.slice(block.indent)).join('\n');
      if (!/^import\s/m.test(code)) {
        console.log(`${file}:${block.from} (${name}) has no import: a fragment, skipped`);
      } else {
        written++;
        const target = path.join(outDir, `readme-example-${written}.check.tsx`);
        fs.writeFileSync(
          target,
          `// ${file}:${block.from} (${name}); temporary, delete with --clean\n` +
            code.replace(/(['"])@mortenbrudvik\/waveui\1/g, "'../index'") +
            '\n',
        );
      }
      block = null;
    } else if (block !== null) {
      block.code.push(line);
    }
  }
}
console.log(`wrote ${written} example files to ${outDir}`);
````

### `measure-size.mjs` — the CHANGELOG "Size" probes (the 0.7.0 method)

````js
// Size probes for the CHANGELOG "Size" section, measured as the 0.7.0 entry was: dist/styles.css
// as built, and minified Vite builds of an entry that imports from <dist>/index.mjs, with bare
// imports external. App mode (rollupOptions.input), not lib mode: lib mode keeps the whitespace
// of ES output and reads about 30% larger.
// Usage (repository root):
//   node node_modules/.cache/wave-docs/measure-size.mjs <dist folder> [Name,Name,*]
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const dist = resolve(process.argv[2] ?? 'dist');
const names = (process.argv[3] ?? 'Button,Toaster,ColorPicker,*').split(',');
const index = resolve(dist, 'index.mjs').replace(/\\/g, '/');
const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
const report = (label, code) =>
  console.log(
    `| ${label} | ${kib(Buffer.byteLength(code))} (${kib(gzipSync(code, { level: 9 }).length)} gzip) |`,
  );

report('`dist/styles.css`', readFileSync(join(dist, 'styles.css')));
const dir = mkdtempSync(join(tmpdir(), 'wave-size-'));
try {
  for (const name of names) {
    const entry = join(dir, `${name === '*' ? 'everything' : name}.mjs`);
    writeFileSync(
      entry,
      name === '*'
        ? `export * from ${JSON.stringify(index)};\n`
        : `export { ${name} } from ${JSON.stringify(index)};\n`,
    );
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      build: {
        write: false,
        minify: true,
        rollupOptions: {
          input: entry,
          preserveEntrySignatures: 'exports-only',
          output: { format: 'es' },
          external: (id) => !id.startsWith('.') && !isAbsolute(id) && !id.startsWith('\0'),
        },
      },
    });
    const chunks = (Array.isArray(result) ? result : [result])
      .flatMap((r) => r.output)
      .filter((o) => o.type === 'chunk');
    report(
      name === '*' ? 'An import of everything' : `An import of only \`${name}\``,
      chunks.map((c) => c.code).join(''),
    );
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
````

Checked while this plan was written, on the published 0.7.0 package: `dist/styles.css` 56.2 KiB (10.0 KiB gzip), only `Button` 10.9 KiB (3.7 KiB gzip), only `Toaster` 19.3 KiB (7.3 KiB gzip), only `ColorPicker` 30.6 KiB (11.2 KiB gzip), everything 369.2 KiB (118.0 KiB gzip). The first two match the 0.7.0 entry; its Menu, Toolbar and everything rows (80.8, 32.5, 366.6 KiB) came from a slightly different build, which is why both columns are re-measured with this one script.

### `measure-compare.mjs` — the comparison guide's size probes (its §9 method)

````js
// WaveUI's column of docs/FLUENT-UI-COMPARISON.md §3.11, measured as its §9 says: esbuild
// --bundle --minify --format=esm --platform=browser --target=es2022, NODE_ENV "production",
// react, react-dom and react/jsx-runtime external, the package's own dependencies bundled,
// gzip level 9. Usage (repository root):
//   node node_modules/.cache/wave-docs/measure-compare.mjs <dist folder>
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const dist = resolve(process.argv[2] ?? 'dist');
const index = resolve(dist, 'index.mjs').replace(/\\/g, '/');
const probes = [
  ['Button', 'Button'],
  ['Button and the provider', 'Button, WaveProvider'],
  ['Button, Field, Input, Checkbox, Switch, Dropdown', 'Button, Field, Input, Checkbox, Switch, Dropdown'],
  ['Dialog, Menu, Popover, Tooltip', 'Dialog, Menu, Popover, Tooltip'],
  ['DataGrid, Table', 'DataGrid, Table'],
  ['Everything', '*'],
];
const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
const css = readFileSync(join(dist, 'styles.css'));
console.log(`| dist/styles.css | ${kib(css.length)} (${kib(gzipSync(css, { level: 9 }).length)} gzip) |`);
const dir = mkdtempSync(join(tmpdir(), 'wave-compare-'));
try {
  for (const [label, names] of probes) {
    const entry = join(dir, 'probe.mjs');
    writeFileSync(
      entry,
      names === '*'
        ? `export * from ${JSON.stringify(index)};\n`
        : `export { ${names} } from ${JSON.stringify(index)};\n`,
    );
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      define: { 'process.env.NODE_ENV': '"production"' },
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      nodePaths: [resolve('node_modules')],
      write: false,
      logLevel: 'silent',
    });
    const code = result.outputFiles[0].contents;
    console.log(`| ${label} | ${kib(code.length)} (${kib(gzipSync(code, { level: 9 }).length)} gzip) |`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
````

Checked while this plan was written: on the published 0.7.0 package it prints exactly the guide's WaveUI 0.7 column (Button 39.0 KiB (12.3 KiB gzip) … Everything 427.4 KiB (141.2 KiB gzip)).

### Getting the published 0.7.0 package (Tasks D1 and D6)

```bash
mkdir -p node_modules/.cache/wave-docs/v070
npm pack @mortenbrudvik/waveui@0.7.0 --pack-destination node_modules/.cache/wave-docs/v070
tar -xzf node_modules/.cache/wave-docs/v070/mortenbrudvik-waveui-0.7.0.tgz -C node_modules/.cache/wave-docs/v070
ls node_modules/.cache/wave-docs/v070/package/dist/index.mjs
```

---

### Task D1: CHANGELOG — the 0.8.0 section

**Files:**
- Modify: `CHANGELOG.md` (the top: the `## [0.8.0] - Unreleased` section; the anchor links of the 0.7.0, 0.6.0 and 0.5.0 sections)

**Interfaces:**
- Consumes: the final API of waves B and C (the grep step lists every name), `dist/` from `npm run build`, and the published 0.7.0 package.
- Produces: the heading set of the 0.8.0 section that Task D2's README links rely on: `### Upgrading from 0.7` (`#upgrading-from-07`), `### Added` (`#added`), `### Changed` (`#changed`; 0.7.0's becomes `#changed-1`, 0.6.0's `#changed-2`), `#### Behaviour`, `#### Visual`, `#### DOM structure`, `#### Types`, `### Deprecated`, `### Size`.

- [ ] **Step 1: Save the tools and take a baseline**

Save `doclinks.cjs`, `renumber.cjs`, `changelog-check.cjs` and `measure-size.mjs` from "Shared verification tools". Then:

```bash
node node_modules/.cache/wave-docs/doclinks.cjs CHANGELOG.md README.md
grep -c '^## \[0.8.0\]' CHANGELOG.md
```

The count is `1` (**case B**, the state since Task 0 merged `main` at 7bd688d): `fix/dialog-surface-margin` opened the section with `### Upgrading from 0.7` items 1–2 (the Dialog surface's margin; the Dialog body's text colour), `### Changed` with `#### Visual` (the body colour) and `#### DOM structure` (the margin); this task merges into it. (A count of `0` means the Task 0 merge is missing: stop and tell the lead; **case A** below is kept only for that situation.) Expected from the link check: exactly two problems, both in `README.md` (lines 1334 and 1349 at 7bd688d): its `CHANGELOG.md#changed` and `CHANGELOG.md#changed-1` links, which the Dialog branch left pointing one version too new (Task D2 fixes them). Fix any other problem first, in a separate commit (`docs(changelog): repair anchor links`), and say so in the report.

- [ ] **Step 2: Renumber the older sections' anchors (before any heading is added)**

Case A (all eight names are new in the file):

```bash
node node_modules/.cache/wave-docs/renumber.cjs CHANGELOG.md added,changed,behaviour,visual,dom-structure,types,deprecated,size
```

Case B (the Dialog branch already added `Changed`, `Visual` and `DOM structure` and renumbered their links):

```bash
node node_modules/.cache/wave-docs/renumber.cjs CHANGELOG.md added,behaviour,types,deprecated,size
```

Expected: `10 links renumbered from line 25` (case B, the CHANGELOG as merged at 7bd688d; measured on a copy at planning time) or `17 links renumbered from line 8` (case A). Another count means other commits added links: Step 7's link check proves each one. Do not run the script twice. If a `### Fixed` or `#### Packaging` heading is added to the 0.8.0 section later in this task, run the script once more with only that name (`fixed` or `packaging`) before adding it.

- [ ] **Step 3: Write the 0.8.0 section**

Case A: insert the whole block below directly above `## [0.7.0] - 2026-09-26`, followed by one blank line.

Case B: merge the same block into the existing section, keeping the Dialog entries where they are: the intro paragraph goes right under `## [0.8.0] - Unreleased` (add a clause for the Dialog fix of issue #4 if the intro names every change); the Dialog's two Upgrading items stay items 1–2 and the nine items below follow as 3–11 (renumber them); `### Added` goes before `### Changed`; `#### Behaviour` goes before the existing `#### Visual`; the block's Visual bullet (the default ColorPicker) goes under the existing `#### Visual`, after the Dialog's bullet; the Dialog's DOM bullet stays first under `#### DOM structure`, with the DOM bullets below after it; `#### Types`, `### Deprecated` and `### Size` follow. Keep every other entry that is already in the section (a `### Fixed`, say) in Keep a Changelog order.

````markdown
## [0.8.0] - Unreleased

The third Fluent UI v9 parity release: Phase 3 of the [roadmap](docs/ROADMAP.md), notifications, color and trees, and a stable class name on every component and part. It closes 4 high, 6 medium and 10 low gaps of the [Fluent UI v9 comparison](docs/research/fluent-ui-v9-comparison.md) (the ids in backticks below) and mitigates one more (`buttons-29`, which the public contexts of Phase 13 close); with it, all seven high gaps of the comparison are closed. Fluent's names are used where they fit Wave's conventions (`Toast.Title`, `MessageBar.Actions`, `ColorArea`, `HsvColor`, `navigationMode`, `Tree.ItemPersonaLayout`, and `buttonClassNames` after Fluent's `*ClassNames`); a state callback is named after its state and receives the value first, with extra data in a second, optional `details` argument (`onCheckedItemsChange(checkedItems, details?)`, Fluent's `onCheckedChange(event, data)`). **Nothing public was removed**, and no public type was narrowed. Changes of behaviour, DOM structure and types that are not additions are listed under [Changed](#changed): read them, and [Upgrading from 0.7](#upgrading-from-07), before upgrading if your tests assert Wave's DOM, class strings or console output.

### Upgrading from 0.7

1. **Stable class names.** Every component root and named part carries a stable class next to its utility classes (`wave-button`, `wave-button__icon`, `wave-toast-title`, …; see [Added](#added)). Assertions on a complete class string, or on the equality of two class lists, change; `toHaveClass(…)` checks do not.
2. **A toast in the Toaster renders inside a container.** Each toast is wrapped in a `role="group"` element with `tabIndex="-1"`, named by its severity and title and described by its body, which now carries `data-wave-toast` (moved from the Toast) and `data-presence`. The 0.5 `title` and body render as the `Toast.Title` and `Toast.Body` elements, with the title text in a span inside the title row. A test that asserted that a toast has no role, or that read the title element's next sibling, changes.
3. **Escape inside the toast region dismisses the toasts.** It no longer closes a Dialog or Drawer below them: focus returns to where it was before it entered the toasts, and the next Escape closes the dialog. A tooltip or menu opened from a toast still closes first.
4. **Every toast pauses while the pointer or focus is anywhere in the toast region.** 0.7 paused the hovered or focused toast only: a test that expects another toast to keep counting down while one is hovered changes.
5. **Toasts with actions stay.** A toast dispatched with content that holds an action (an interactive element besides its Dismiss button) stays until it is dismissed, unless the dispatch passes a `timeout`. The options form (`dispatchToast({ title, body })`) is unchanged.
6. **MessageBar** renders `data-layout` (`singleline` or `multiline`) on every bar; a bar without `MessageBar.Actions` looks and reads as in 0.7.
7. **Tree** renders `data-selection-mode` (`none` unless you set `selectionMode`).
8. **ColorPicker.** The default picker gains a color area and a hue slider above its 0.7 layout, and with `showOpacity` its opacity slider becomes an alpha slider over a checkerboard (still named "Opacity", 0–100). `children` of ColorPicker now render a custom layout; 0.7 ignored them. See [Visual](#visual).
9. **`ToastController['dispatchToast']` is overloaded** (`dispatchToast(content, options?)` next to `dispatchToast(options)`): a test double that implements the interface must accept content too. `Parameters<ToastController['dispatchToast']>` is unchanged.

### Added

- **Stable class names**: every public component and part renders a stable class: `wave-` and the kebab-cased component name on the element that receives your `className` (`wave-button`, `wave-card-header`, `wave-menu-item-checkbox`), and `<root>__<part>` on its parts (`wave-button__icon`, `wave-tag__dismiss-button`, `wave-tree-item__expand-icon`). The package entry exports them as typed constants, one per component (`buttonClassNames` is `{ root: 'wave-button', icon: 'wave-button__icon' }`, `as const`), from a server-safe module, so a Server Component can read them. A component built on another also carries the other's classes (ToggleButton is `wave-button wave-toggle-button`, its icon `wave-button__icon wave-toggle-button__icon`; the menu item kinds carry `wave-menu-item`; CounterBadge carries `wave-badge`), and a public component rendered inside another gets the parent's part class (SplitButton's halves are `wave-button wave-split-button__primary-action-button` and `wave-button wave-split-button__menu-button`). `WaveProvider` keeps `wave-root` and `Portal` `wave-portal`; components that render no element of their own (Dialog, Popover, Presence, the trigger and close parts) have none. There are no state classes (use the `data-*` attributes), Tailwind generates no CSS for them, and Wave never styles through them. A conventions-gate rule, the component tests and `verify-dist` check that every component applies its classes. See [README: Styling hooks](README.md#styling-hooks). Closes `foundation-37`, and mitigates `buttons-29` (static class names are half of it; public contexts and recomposition hooks follow in Phase 13).
- **Toast**:
  - **React content**: `dispatchToast(content, options?)` shows any React content, usually a `<Toast>` with parts, and returns its id, next to 0.5's `dispatchToast(options)`. A plain object is read as options; an element, a portal, a string, a number or an array is content. `ToastDispatchOptions`: `toastId`, `timeout` (5000 ms by default, and no timeout for a toast with an action), `status` and `statusLabel` (for content that renders no `Toast`: a rendered Toast's own `status` wins, with a development warning when the options pass a different one) and `announcement` (text announced instead of the title, body and action labels). The Toaster announces a toast once, through its permanent live regions: its severity, title, body (with its subtitle) and the labels of its actions, never the Dismiss button ("Success: Email sent Your message was delivered. Undo"), read from the rendered elements (hidden text skipped, an image's `alt` read); `error` is assertive, the others polite. Dispatching the same `toastId` again replaces the toast and announces it again. Closes `toast-1`.
  - **Parts**: `Toast.Title` (the title text, which names the toast, and an `action` slot at the end of its row), `Toast.Body` (the body text and a `subtitle`, which describe the toast), `Toast.Footer` (a row of actions) and `Toast.Close`, which makes its single child dismiss the toast: it calls the Toast's `onDismiss`, then dismisses the toast in the Toaster; your `onClick` runs first, and `preventDefault()` keeps the toast (Fluent's `ToastTrigger`). `icon` replaces the status icon (only `undefined` keeps it; `null` shows none, the status-icon rule of `MessageBar.icon`). The 0.5 `title` prop and plain children render as the Title and Body parts. Every Toast in a Toaster shows the Dismiss button, rich ones included. Flat names for Server Components: `ToastTitle`, `ToastBody`, `ToastFooter` and `ToastClose`, with the types `ToastTitleProps`, `ToastBodyProps`, `ToastFooterProps`, `ToastCloseProps`, `ToastCloseRenderProps` and `ToastDispatchOptions`. Closes `toast-2`, `toasttrigger-1`, `toast-3`.
  - **Keyboard**: Toaster `shortcuts` (`ToasterShortcuts`, Fluent's shape): `shortcuts.focus(event)` returns `true` for the key press that moves focus to the newest toast (use a modifier: `(event) => event.altKey && event.shiftKey && event.code === 'KeyN'`). Escape in the toast region dismisses every toast and returns focus to where it was (a tooltip or menu opened from a toast closes first); Delete or Backspace dismisses the focused toast, and focus moves to the next one. Closes `toaster-2`.
  - **Toaster handle**: `createToaster()` returns a `ToasterHandle` (a `ToastController`) that code outside components can call (a query cache, an event handler, a helper module), and `<Toaster toaster={handle}>` binds one Toaster to it; toasts dispatched through it render there, with the React context of the Toaster's place (a router for a link). Dispatches before a Toaster binds wait in the handle's queue, ids are returned at once, and a dispatch on the server does nothing, so a module-scope handle is safe during server rendering. A handle binds one Toaster (a second one warns in development); one handle per Toaster runs several Toasters (Fluent's `toasterId`). Closes `toaster-5`.
  - Toasts in a Toaster mount through the presence core: a dismissed toast stops counting toward `limit` at once and stays mounted, `inert`, while an exit motion of yours runs on `.wave-toaster__toast[data-presence='exiting']`; focus has already moved to the next toast.
- **MessageBar**: `MessageBar.Title` (a semibold lead-in, read right after the severity; it names a bar that has a non-live `role`, such as `role="region"`) and `MessageBar.Actions` (buttons after the text, or on a row of their own below it), as direct children; `layout` (`'auto'`, the default, `'singleline'` or `'multiline'`): `'auto'` keeps the actions on the text's row while the text fits on one line and moves them below when it does not (measured with a ResizeObserver; the server renders one row). No layout cuts text off, and both layouts keep one DOM order (icon, text, actions, Dismiss), so a reflow never moves the focused button. A bar with `role="region"` and neither a title nor a label warns in development. Flat names `MessageBarTitle` and `MessageBarActions`, with `MessageBarTitleProps` and `MessageBarActionsProps`. Closes `messagebar-1`, `messagebar-2`, `messagebar-3`.
- **Color**:
  - **`ColorArea`**: a 2-D field for saturation (left to right, mirrored in RTL) and brightness (bottom to top) at the color's hue, with two visually hidden native range inputs for keyboards and assistive technology: one Tab stop, one exposed slider on desktop and two on touch devices. The arrows move by 1%, Shift with an arrow by 10, Page Up and Page Down brightness by 10, Home and End saturation to 0 and 100; a pointer press jumps and drags (mouse, touch, pen). Each input's value text names the color ("Saturation 72%, Brightness 74%, dark blue"). `value`/`defaultValue`/`onValueChange` take an `HsvColor`, with `shape`, `labels`, `disabled`, `name`/`form`/`required` (the hex value is submitted) and `controlRef`; the thumb is 24×24 px with a two-tone ring and focus indicator that show on any color and in forced colors. Closes `colorarea-1`.
  - **`ColorSlider`** (`channel`: `'hue'`, the default, `'saturation'` or `'value'`; `orientation`: horizontal, mirrored in RTL, or vertical) and **`AlphaSlider`** (opacity over a checkerboard; `transparency` shows transparency instead): one native range input each, the keys of `ColorArea` on their axis, and value texts ("210°, blue", "72%", "40%"). Closes `colorslider-1`, `alphaslider-1`.
  - **Composable ColorPicker**: `children` render your own layout. A `ColorArea`, `ColorSlider` or `AlphaSlider` inside a ColorPicker without `value` and `defaultValue` binds to the picker, which is Fluent's composition (`<ColorPicker><ColorArea /><ColorSlider /><AlphaSlider /></ColorPicker>`); `ColorPicker.HexField`, `ColorPicker.Swatches` and `ColorPicker.Preview` are the picker's own parts (flat `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview`). The value stays a hex string, and a working HSV color keeps the hue and saturation through grays, white and black. `shape` (`'rounded'`, `'square'`) is inherited by bound parts, and `ColorPickerLabels` gains the strings of the parts, `colorName` and `valueText`. Closes `colorpicker-1`, `colorpicker-3`; the `RgbAndHslFields` story is the recipe for RGB and HSL fields (`colorpicker-2`).
  - **Types and helpers**: `HsvColor` (`{ h, s, v, a? }`, Fluent's type), `ColorPickerShape`, the server-safe `hsvToHex(color)` and `hexToHsv(hex)`, and `ColorAreaProps`, `ColorAreaLabels`, `ColorSliderProps`, `ColorSliderLabels`, `AlphaSliderProps`, `AlphaSliderLabels`, `ColorPickerHexFieldProps`, `ColorPickerSwatchesProps` and `ColorPickerPreviewProps`.
- **Tree**:
  - **Multi-select**: `selectionMode` (`'none'`, the default, `'single'` or `'multiple'`; Fluent's `'multiselect'` is `'multiple'`). `'multiple'` draws a checkbox on every item, bound to `checkedItems`/`defaultCheckedItems`/`onCheckedItemsChange(checkedItems, details?)` (`details` is `{ value, checked, event }`, `TreeCheckedItemsChangeDetails`). Checks cascade: checking an item checks its descendants, and a parent shows checked, mixed or unchecked from them; the callback receives every checked item in tree order, followed by the listed values that match no item. Space toggles the focused item, a click on its checkbox toggles it, and a click elsewhere on the row activates it; the checkbox is an exposed `role="checkbox"` named by the item, outside the Tab order. `'single'` draws radio indicators for `selected`/`onItemSelect`. Closes `tree-1`.
  - **Row content**: `Tree.Item` `actions` (buttons at the end of the row, in a toolbar named by the item; shown on hover and focus, always in forced colors and without hover), `aside` (content at the end of the row, part of the item's description), `iconAfter` and `expandIcon`; Tree `navigationMode` (`'tree'`: Tab from the focused item enters its actions; `'treegrid'`: the "next" arrow moves into them). Keys and clicks on the actions never activate, check or expand the item. `Tree.ItemPersonaLayout` (flat `TreeItemPersonaLayout`, Fluent's name) lays out an item's label as a person (`media`, the name, a `description`), with `TreeItemPersonaLayoutProps`. Closes `tree-2`, `tree-7`, `tree-8`.
- **`useRovingTabIndex`** `tabStop` gains `'none'` (next to `'active'`, the default, and `'last-focused'`): every item stays at `tabIndex=-1`, for a composite reached by arrow keys only (a Tree row's actions).

### Changed

#### Behaviour

- **Escape in the toast region** (P3-03): the Toaster takes an Escape pressed inside its region, prevents it and dismisses every toast, returning focus to where it was before focus entered the toasts. A Dialog or Drawer below the toasts no longer closes on that Escape (its next Escape closes it). An open tooltip or menu of a toast closes first, and a key pressed in a Menu, Popover or Dialog opened from a toast stays that surface's.
- **Every toast pauses while the pointer or focus is anywhere in the toast region**, and while the window is in the background (as in 0.7); 0.7 paused the hovered or focused toast only. Focus in a menu opened from a toast counts.
- **A toast dispatched with content that holds an action stays until it is dismissed**, unless the dispatch passes a `timeout` (an Undo that vanished after 5 seconds is a time limit that people who use a screen reader, a switch or voice control often cannot meet, WCAG 2.2.1). The options form keeps 5000 ms.
- **ColorPicker `children`** render a custom layout of the color parts; 0.7 ignored them.

#### Visual

- **The default ColorPicker** gains a color area and a hue slider above its 0.7 layout (preview and hex field, presets, opacity), and with `showOpacity` its opacity slider becomes an alpha slider over a checkerboard. The opacity row keeps its caption and percentage readout, and the slider keeps its name ("Opacity", `labels.opacity`), its role and its 0–100 values. For another layout, compose the parts.

#### DOM structure

- Every component root and part carries its stable class (see [Added](#added)); the `data-wave-*` markers stay.
- **Toaster**: every toast renders inside a `role="group"` container (`tabIndex="-1"`, `aria-labelledby` pointing at the severity text and the title, `aria-describedby` at the body), which carries `data-wave-toast` (moved from the Toast) and `data-presence`. The 0.5 title and body render as `Toast.Title` (a row holding the title span) and `Toast.Body`. Content that renders no `Toast` gets a visually hidden severity text first inside its container.
- **MessageBar** renders `data-layout`; with `MessageBar.Actions`, the text column and the actions sit in a layout wrapper between the icon and the Dismiss button, side by side in the one-row layout and stacked (the actions under the text) in the multiline layout. A bar without actions keeps 0.7's markup.
- **Tree** renders `data-selection-mode`. In `'multiple'`, the tree has `aria-multiselectable="true"`, every item `aria-checked` (`true`, `false` or `mixed`) and `data-checked` or `data-mixed`, and every row a `role="checkbox"` element; in `'single'`, every item has `aria-selected` and its row a decorative radio.
- **The color parts** render `data-orientation` and `data-channel` (ColorSlider; AlphaSlider `data-orientation`) and `data-disabled` while disabled.
- As in 0.7, enumerated attributes are always present with their value (`data-layout`, `data-selection-mode`, `data-orientation`, `data-channel`, `data-presence`) and boolean ones are present (`""`) or absent (`data-checked`, `data-mixed`, `data-disabled`).

#### Types

- `ToastController['dispatchToast']` is an overloaded member: `(content: React.ReactNode, options?: ToastDispatchOptions) => string` and `(options: ToastOptions) => string`. `Parameters<ToastController['dispatchToast']>` is still `[options: ToastOptions]`; code that implements the interface (a test double) must accept content too.
- `typeof Toast`, `typeof MessageBar` and `typeof ColorPicker` gain static members, and `typeof Tree` gains `ItemPersonaLayout`.
- `ToastProps` gains `icon`; `ToasterProps` gains `shortcuts` and `toaster`; `MessageBarProps` gains `layout`; `ColorPickerProps` gains `shape` and documents `children`; `ColorPickerLabels` gains the strings of the bound parts; `TreeProps` gains `selectionMode`, `checkedItems`, `defaultCheckedItems`, `onCheckedItemsChange` and `navigationMode`; `TreeItemProps` gains `actions`, `aside`, `iconAfter` and `expandIcon`; `UseRovingTabIndexOptions['tabStop']` gains `'none'`.

### Deprecated

- Nothing new is deprecated.
- **Notice:** the `details` parameter of Tree `onCheckedItemsChange` becomes required in 1.0, like `onOpenChange`'s and `onCheckedValuesChange`'s. Wave always passes it; read it as `details?.value` until then.
- **The stable class names are public API** under the 0.x promise: no class is removed before 1.0. A renamed part, or a part that becomes a compound member of its own, keeps its old class next to the new one until 1.0 (listed here as deprecated); a class that moves to another element is a "Changed" DOM entry; a new class or part is no change.

### Size

Against 0.7.0 as published on npm, measured the way 0.7 did: `dist/styles.css` as built, and minified Vite builds of an entry that imports from `dist/index.mjs`, with bare imports external. Both versions were measured with the same script (0.7.0 from its npm package). Sizes are in KiB (1,024 bytes):

| Output | 0.7.0 | 0.8.0 |
|---|---|---|
| `dist/styles.css` | 56.2 KiB (10.0 KiB gzip) | «styles» |
| An import of only `Button` | 10.9 KiB (3.7 KiB gzip) | «Button» |
| An import of only `Toaster` | 19.3 KiB (7.3 KiB gzip) | «Toaster» |
| An import of only `ColorPicker` | 30.6 KiB (11.2 KiB gzip) | «ColorPicker» |
| An import of everything | 369.2 KiB (118.0 KiB gzip) | «everything» |

- An import of only `Button` contains none of the color, toast or tree modules (`verify-dist` gates it) and grows by the class-name strings it uses: Rollup keeps only the constants a bundle reads, and `verify-dist` fails when the Button-only bundle keeps another component's class (`'wave-dialog-content'`).
- `Toaster` now carries its parts, the presence core and the keyboard handling; `ColorPicker` its area, sliders and parts.
- `dist/styles.css` grows by the utilities of the new components and parts; the stable class names add no CSS.
- `verify-dist` also checks that the entry exports every class-name constant with the same value (ESM and CommonJS), that a Server Component can read them and can load `createToaster`, that an import of only `Toaster` contains the presence core, and that `dist/index.d.ts` declares `buttonClassNames`.
````

- [ ] **Step 4: Measure the sizes and fill the table**

```bash
npm run build
node node_modules/.cache/wave-docs/measure-size.mjs dist Button,Toaster,ColorPicker,*
```

Then get the published 0.7.0 package (commands in "Shared verification tools") and re-measure it with the same script:

```bash
node node_modules/.cache/wave-docs/measure-size.mjs node_modules/.cache/wave-docs/v070/package/dist Button,Toaster,ColorPicker,*
```

Expected for 0.7.0: the numbers already in the 0.7.0 column (56.2 KiB (10.0 KiB gzip), 10.9 KiB (3.7 KiB gzip), 19.3 KiB (7.3 KiB gzip), 30.6 KiB (11.2 KiB gzip), 369.2 KiB (118.0 KiB gzip)). If the tools changed and a number differs, write both columns from this run. Replace each `«…»` cell with the 0.8.0 line's value (`12.0 KiB (4.0 KiB gzip)` form). Then check the three bullets under the table against the numbers: when the Button-only growth is more than about 0.3 KiB, or `dist/styles.css` shrank, find the cause (ask the lead) before writing a bullet that says otherwise.

```bash
grep -c '«' CHANGELOG.md
```

Expected: `0`.

- [ ] **Step 5: TreeLabels, only if the VoiceOver spike added it**

```bash
grep -n "TreeLabels" src/components/layout/Tree.core.tsx src/components/layout/index.ts
```

If it prints nothing, skip this step. Otherwise add this sentence at the end of the Tree "Multi-select" bullet (before `Closes \`tree-1\`.`): `` `labels` (`TreeLabels`: `checked`, `mixed`, `unchecked`) gives each item of a checkbox tree a visually hidden state text, since VoiceOver does not announce `aria-checked` on a tree item. `` and add `labels` to the `TreeProps` list of `#### Types`.

- [ ] **Step 6: Confirm every stated name against the code**

```bash
grep -n "export const buttonClassNames\|export const waveProviderClassNames\|export const portalClassNames" src/lib/classNames.ts
grep -n "classNames\|hsvToHex\|createToaster" src/index.ts
grep -n "export function createToaster\|export interface ToasterHandle" src/lib/toaster.ts
grep -n "export function hsvToHex\|export function hexToHsv" src/lib/color.ts
grep -n "export interface HsvColor\|export type ColorPickerShape" src/lib/types.ts
grep -n "toastId?:\|timeout?:\|status?:\|statusLabel?:\|announcement?:\|shortcuts?:\|toaster?:\|@default" src/components/feedback/Toaster.tsx
grep -n "icon?:\|action?:\|subtitle?:\|asChild?:" src/components/feedback/Toast.root.tsx src/components/feedback/Toast.parts.tsx
grep -n "layout?:\|@default" src/components/feedback/MessageBar.tsx
grep -n "channel?:\|orientation?:\|transparency?:\|shape?:\|@default" src/components/input/ColorArea.tsx src/components/input/ColorSlider.tsx src/components/input/AlphaSlider.tsx src/components/input/ColorPicker.tsx
grep -n "selectionMode?:\|checkedItems?:\|defaultCheckedItems?:\|onCheckedItemsChange?:\|navigationMode?:\|actions?:\|aside?:\|iconAfter?:\|expandIcon?:" src/components/layout/Tree.core.tsx
grep -n "tabStop?:" src/hooks/useRovingTabIndex.ts
grep -rhno "warnOnce(\s*'[A-Za-z.]*:[a-z-]*'" src/components/feedback src/components/input src/components/layout | sort -u
grep -n "ToastTitle\|ToastBody\|ToastFooter\|ToastClose\|MessageBarTitle\|MessageBarActions\|ToastDispatchOptions\|ToasterShortcuts" src/components/feedback/index.ts
grep -n "ColorArea\|ColorSlider\|AlphaSlider\|ColorPickerHexField\|ColorPickerSwatches\|ColorPickerPreview" src/components/input/index.ts
grep -n "TreeItemPersonaLayout\|TreeCheckedItemsChangeDetails" src/components/layout/index.ts
```

Compare each prop, default, type and warning the section states with the output (and the JSDoc around it). Where the code differs, change the section to the code and note it for the wave D report. Expected: every name exists; the defaults are `5000` (toast timeout), `'auto'` (layout), `'hue'` (channel), `'horizontal'` (orientation), `false` (transparency), `'rounded'` (shape), `'none'` (selectionMode), `'tree'` (navigationMode), `'active'` (tabStop, whose union gains `'none'`).

- [ ] **Step 7: Verify the section and the links**

```bash
node node_modules/.cache/wave-docs/changelog-check.cjs CHANGELOG.md
node node_modules/.cache/wave-docs/doclinks.cjs CHANGELOG.md README.md
```

Expected: `0.8.0 section: 9 headings, 11 upgrading items, 0 problems` (case B; 9 items in case A, and 10 headings when a `### Fixed` exists), and exactly three link problems, none of them this task's to fix: `CHANGELOG.md:<line> README.md#styling-hooks matches no heading` (the Added bullet links a README section that Task D2 adds) and the two `README.md` links `CHANGELOG.md#changed` and `CHANGELOG.md#changed-1` of "Upgrading from 0.6" and "Upgrading from 0.5" (now one version too new; Task D2 fixes them). Any other problem is this task's to fix.

- [ ] **Step 8: Commit**

```bash
git status --short
git add CHANGELOG.md
git commit -m "docs(changelog): the 0.8.0 section for Phase 3"
```

Expected: `git status --short` lists only `CHANGELOG.md` before the commit.

---

### Task D2: README

**Files:**
- Modify: `README.md` (intro and table of contents; "Styling hooks" (new, after "Global effects"); "React Server Components"; "Components"; "Usage notes": "Forms and `Field`", "Value callbacks", "Composite controls", "Color" (new, after "Composite controls"), "Enter and exit motion", "Toasts" (rewritten), "Message bars" (new, after "Toasts"), "Trees" (new, after "Sorting and selecting in a DataGrid"), "Slots", "Built-in text"; "Keyboard support"; "Hooks and utilities"; "Upgrading from 0.7" (new); the CHANGELOG anchors of "Upgrading from 0.6" and "Upgrading from 0.5")

**Interfaces:**
- Consumes: Task D1's CHANGELOG headings (`#changed`, `#changed-1`, `#changed-2`, `#upgrading-from-07`); the final API (grep step).
- Produces: README anchors other docs link to: `#styling-hooks`, `#toasts`, `#message-bars`, `#color`, `#trees`, `#upgrading-from-07`.

- [ ] **Step 1: Save the tools and take a baseline**

Save `doclinks.cjs` and `readme-examples.cjs` if they are missing. Then:

```bash
npx prettier --check README.md
node node_modules/.cache/wave-docs/doclinks.cjs README.md
```

Expected: Prettier passes; the link check reports at most the two stale `CHANGELOG.md#changed…` links (fixed in Step 16).

- [ ] **Step 2: Intro and table of contents**

In the first paragraph, replace `65 accessible, composable components` with `68 accessible, composable components`. Replace the second and fourth lines of the contents list:

```markdown
- [Styles](#styles) · [Theming](#theming) · [Global effects](#global-effects) · [Styling hooks](#styling-hooks)
```

```markdown
- [Keyboard support](#keyboard-support) · [Hooks and utilities](#hooks-and-utilities) · [Upgrading from 0.7](#upgrading-from-07) · [Upgrading from 0.6](#upgrading-from-06) · [Upgrading from 0.5](#upgrading-from-05) · [Upgrading from 0.4](#upgrading-from-04) · [Development](#development)
```

- [ ] **Step 3: Add "Styling hooks" after "Global effects"**

Insert directly above `## React Server Components`:

````markdown
## Styling hooks

Every component root and every named part carries a stable class that your own CSS can target: `wave-<component>` on the root and `wave-<component>__<part>` on a part.

```css
/* app.css */
.wave-button__icon {
  color: var(--wave-primary);
}
.wave-tree-item__actions {
  gap: 2px;
}
```

The package exports the same names as typed constants, one per component (`as const`), so a selector built from them is checked by TypeScript:

```tsx
import { buttonClassNames, treeItemClassNames } from '@mortenbrudvik/waveui';

// `.${buttonClassNames.icon}` is '.wave-button__icon'.
export const iconSelector = `.${buttonClassNames.icon}`;

export function checkedRows(tree: HTMLElement) {
  return tree.querySelectorAll(`.${treeItemClassNames.root}[aria-checked='true']`);
}
```

- **Names.** The root class is `wave-` and the kebab-cased component name (`CardHeader` → `wave-card-header`, `Menu.ItemCheckbox` → `wave-menu-item-checkbox`); a part adds `__` and its name (`wave-tag__dismiss-button`). The constant is the camel-cased flat name plus `ClassNames` (`cardHeaderClassNames`). `WaveProvider` keeps `wave-root` and `Portal` `wave-portal`. Components that render no element of their own (Dialog, Popover, Presence, and the trigger and close parts, which clone your element) have none.
- **Where they sit.** The root class is on the element that receives your `className` (Input with `contentBefore` or `contentAfter`: the wrapper; `RadioGroup.Item`: its label). A slot's part class stays when a slot object swaps the element (`icon={{ as: 'img', … }}`).
- **Variants and nesting.** A component built on another carries both classes: ToggleButton is `wave-button wave-toggle-button` (its icon `wave-button__icon wave-toggle-button__icon`), so `.wave-button` styles every button; the menu item kinds carry `wave-menu-item`, and CounterBadge carries `wave-badge`. A public component rendered inside another also gets the parent's part class: SplitButton's halves are `wave-button wave-split-button__primary-action-button` and `wave-button wave-split-button__menu-button`.
- **No state classes.** State is in the `data-*` attributes and ARIA (`.wave-button[data-pressed]`, `.wave-tree-item[aria-checked='mixed']`); there is no `wave-button--pressed`.
- **Cascade.** Wave never styles through these classes and Tailwind generates nothing for them, so your rules are the only ones on them. With the precompiled `./styles` (unlayered), a one-class rule of yours ties with Wave's utility classes and wins when it comes later; on the Tailwind path Wave's utilities sit in Tailwind's `utilities` layer, and any unlayered rule of yours wins.
- **Stable.** The names are public API: no class is removed before 1.0. A renamed part, or a part that becomes a compound member of its own, keeps its old class next to the new one until 1.0; moving a class to another element is listed in the CHANGELOG as a DOM change. Per-part documentation comes with the part props of a later release (P13-01 in the [roadmap](docs/ROADMAP.md)).
- **Server Components.** The constants come from a server-safe module: a Server Component can import them from the entry.
````

- [ ] **Step 4: React Server Components**

Replace the first bullet of the section with:

```markdown
- Every component and hook module of the package starts with `"use client"`. The entry point, `cn`, the slot helpers, the class-name constants (`buttonClassNames`, …), `hsvToHex`, `hexToHsv`, `createToaster` and the types are server-safe, so a Server Component can import from `@mortenbrudvik/waveui`, read the constants, create a toaster handle and render Wave components with serializable props.
```

In the third bullet, replace `List, Nav, TabList and Tree items, and a \`Button\` passed as a MessageBar, SearchBox or Tag dismiss slot.` with:

```markdown
List, Nav, TabList and Tree items, the parts of Toast and MessageBar, the ColorPicker parts, `Tree.ItemPersonaLayout`, and a `Button` passed as a MessageBar, SearchBox or Tag dismiss slot.
```

In the flat-name table, add three rows and extend the Tree row (Prettier aligns them in Step 18; keep the alphabetical order: `ColorPicker` after `Carousel`, `MessageBar` after `Menu`, `Toast` after `Table`):

```markdown
| `ColorPicker` | `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview` |
| `MessageBar` | `MessageBarTitle`, `MessageBarActions` |
| `Toast` | `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose` |
| `Tree` | `TreeItem`, `TreeItemPersonaLayout` |
```

- [ ] **Step 5: Components**

Replace `65 components, plus the \`Portal\` and \`Presence\` utilities.` with `68 components, plus the \`Portal\` and \`Presence\` utilities.`

In "Inputs and forms", replace the `ColorPicker` row and add three rows after it:

```markdown
| `ColorPicker`  | Hex value (lowercase `#rrggbb`, or `#rrggbbaa` when not opaque) with a color area, a hue slider, a hex field, preset swatches and an optional opacity slider; with children, your own layout of `ColorArea`, `ColorSlider` and `AlphaSlider` (bound to the picker) and `ColorPicker.HexField`, `.Swatches`, `.Preview` (see [Color](#color)); `shape`. Picking a preset keeps the current opacity (a preset's alpha digits are ignored, with a development warning). |
| `ColorArea`    | 2-D saturation and brightness field for an `HsvColor`, with two hidden range inputs (one Tab stop), pointer and touch dragging; mirrored in RTL. |
| `ColorSlider`  | Hue (default), saturation or brightness slider (`channel`), horizontal or vertical. |
| `AlphaSlider`  | Opacity slider over a checkerboard; `transparency` shows transparency. |
```

In "Layout", replace the `Tree` row:

```markdown
| `Tree`      | Hierarchical tree (`Tree.Item`) with expand/collapse and typeahead; single selection, or checkboxes with a cascading mixed state (`selectionMode="multiple"`); row `actions`, `aside` and `Tree.ItemPersonaLayout`; `navigationMode="treegrid"` (see [Trees](#trees)). Nested items are `Tree.Item` elements in their parent's children (directly, in Fragments or from a render function), not rendered by a recursive component; values are unique. |
```

In "Feedback", replace the `MessageBar` and `Toast` rows:

```markdown
| `MessageBar`  | Inline status message (`info`, `success`, `warning`, `error`) with hidden status text, `MessageBar.Title`, `MessageBar.Actions` that reflow with `layout`, and an optional dismiss button (see [Message bars](#message-bars)). |
| `Toast`       | Notifications shown by `<Toaster>` (`limit` queues the rest): a `<Toast>` with `Toast.Title`, `.Body`, `.Footer` and `.Close`, or text, dispatched through `useToastController()` or a `createToaster()` handle; a keyboard shortcut, Escape and Delete (see [Toasts](#toasts)). |
```

- [ ] **Step 6: Forms and `Field`**

In the first bullet after the two examples, replace `(\`Checkbox\`, \`Switch\`, \`RadioGroup\`, \`Rating\`, \`SwatchPicker\`, \`ColorPicker\`, \`Combobox\`,` with `(\`Checkbox\`, \`Switch\`, \`RadioGroup\`, \`Rating\`, \`SwatchPicker\`, \`ColorPicker\`, \`ColorArea\`, \`ColorSlider\`, \`AlphaSlider\`, \`Combobox\`,`.

Replace the last bullet of the section ("Value controls take part in native forms…") with:

```markdown
- Value controls take part in native forms when you pass `name`, or when they are required (their own `required`, or a required `Field`): `Checkbox`, `Switch`, `RadioGroup`, `Rating`, `SpinButton`, `SwatchPicker`, `ColorPicker`, `ColorArea`, `ColorSlider` and `AlphaSlider` (the hex of the color; inside a ColorPicker they are bound and the picker submits), `Combobox`, `Dropdown`, `TagPicker`, `DatePicker` (ISO `yyyy-mm-dd`) and `TimePicker` (`HH:mm`) render a hidden input, honour `required` and `form`, and reset with their form. `SearchBox` submits through its own `<input name>` and resets with its form too. No name is generated for you.
```

- [ ] **Step 7: Value callbacks**

Add a row to the table, after the "checked values" row:

```markdown
| checked items (Tree) | `checkedItems` / `defaultCheckedItems` / `onCheckedItemsChange(checkedItems, details)` |
```

In the paragraph under the table, replace `and Menu and Toolbar call \`onCheckedValuesChange(checkedValues, details)\` with \`details.name\`, \`details.checkedItems\` (the group's new values) and \`details.event\` (see [Menus](#menus)).` with:

```markdown
Menu and Toolbar call `onCheckedValuesChange(checkedValues, details)` with `details.name`, `details.checkedItems` (the group's new values) and `details.event` (see [Menus](#menus)), and Tree calls `onCheckedItemsChange(checkedItems, details)` with `details.value`, `details.checked` and `details.event` (see [Trees](#trees)).
```

and in the same paragraph replace `(\`openItems\`, \`expandedItems\`, \`selectedItems\`,` with `(\`openItems\`, \`expandedItems\`, \`checkedItems\`, \`selectedItems\`,`.

- [ ] **Step 8: Composite controls**

Append this paragraph at the end of the section (after the Input paragraph):

```markdown
`ColorSlider`, `AlphaSlider` and `ColorPicker.HexField` route the same props to their `<input>` and take `controlRef`. `ColorArea` is a group around two inputs: the group keeps `aria-label`, `aria-labelledby` and `aria-describedby` (a Field's label names it), with `className`, `style`, `data-*` and `ref`; both inputs get `aria-invalid` and `aria-errormessage`; `autoFocus`, `tabIndex` and `controlRef` reach the saturation input.
```

- [ ] **Step 9: Add "Color" after "Composite controls"**

Insert directly above `### Menus`:

````markdown
### Color

```tsx
import * as React from 'react';
import { AlphaSlider, ColorArea, ColorPicker, ColorSlider, Field } from '@mortenbrudvik/waveui';

export function AccentPicker() {
  const [accent, setAccent] = React.useState('#0f6cbd');
  return (
    <Field label="Accent color">
      <ColorPicker value={accent} onValueChange={setAccent} name="accent">
        <ColorArea />
        <ColorSlider />
        <AlphaSlider />
        <ColorPicker.HexField />
        <ColorPicker.Swatches />
      </ColorPicker>
    </Field>
  );
}
```

- **The picker and its parts.** Without children, a ColorPicker renders a color area and a hue slider, then its 0.7 layout: the preview and hex field, the presets and, with `showOpacity`, the opacity slider. With children it renders your layout: `ColorArea`, `ColorSlider` and `AlphaSlider` bind to the picker when you pass them neither `value` nor `defaultValue` (Fluent's composition), and `ColorPicker.HexField`, `ColorPicker.Swatches` (the picker's `presets`) and `ColorPicker.Preview` are the picker's own parts. Bound parts read and write the picker's color, take its `shape`, `labels` and disabled state, and submit nothing themselves: the picker's hidden input submits the hex value (`name`, `form`, `required`), and a form reset restores its `defaultValue`. A part with its own `value` or `defaultValue` stays independent.
- **Hex and HSV.** The picker's value is a hex string, as in 0.7 (`#rrggbb`, or `#rrggbbaa` below full opacity). The standalone parts take an `HsvColor` (`{ h, s, v, a? }`: `h` from 0 to 360, `s`, `v` and `a` from 0 to 1, no `a` meaning opaque; Fluent's type), and `hsvToHex(color)` and `hexToHsv(hex)` convert (`hexToHsv` returns `null` for text that is not a hex color). Inside the picker, the hue and saturation survive grays, white and black, which a hex value cannot carry. A value that is not a hex color disables the bound parts until a hex value arrives.
- **Keys and pointer.** `ColorArea` is one Tab stop: Left and Right change saturation (mirrored in RTL), Up and Down brightness, Shift with an arrow by 10, Page Up and Page Down brightness by 10, Home and End saturation to 0 and 100. `ColorSlider` and `AlphaSlider` take the arrows of their axis (by 1, Shift by 10), Page Up and Page Down (by 10), Home and End. A press on the area jumps there and drags, with a mouse, touch or a pen.
- **Assistive technology.** The area is a group of two sliders, "Saturation" and "Brightness": desktop screen readers list one 2-D slider, and touch screen readers can swipe each. Each value text starts with its own channel and names the color ("Saturation 72%, Brightness 74%, dark blue"); a hue slider says "210°, blue". `labels.colorName(color)` replaces the English color names (return `''` to leave them out), and `labels.valueText(color, channel)` a whole value text, for languages whose word order differs.
- `ColorSlider` takes `channel` (`'hue'`, `'saturation'` or `'value'`) and `orientation` (`'vertical'` draws the rail bottom to top); `AlphaSlider` shows opacity, or with `transparency` transparency (the value's `a` is still the opacity). The roots carry `data-orientation`, `data-channel` (ColorSlider) and, while disabled, `data-disabled`. `shape="square"` removes the corner radius. Inside a `Field`, a standalone slider is named by the Field's label, else by its `labels` ("Hue", "Saturation", "Brightness").
````

- [ ] **Step 10: Enter and exit motion**

Replace the last bullet of the section (`- \`Menu.Popover\` mounts through the presence core, …`) with:

```markdown
- `Menu.Popover` and the toasts in a `Toaster` mount through the presence core, so menus and toasts take exit classes too (see [Menus](#menus) and [Toasts](#toasts)). An enter class for them takes the same gate; a menu that is open when it mounts (`defaultOpen`) mounts `entered`, so it does not animate that first time. The other overlays get their motion in a later release.
```

- [ ] **Step 11: Rewrite "Toasts"**

Replace everything from `### Toasts` down to (not including) `### Badges` with:

````markdown
### Toasts

Wrap the app (or the part that shows toasts) in `<Toaster>`; `useToastController()` throws in development outside it. Dispatch a `<Toast>` with its parts:

```tsx
import { Button, Toast, Toaster, useToastController } from '@mortenbrudvik/waveui';

function SendButton({ onUndo }: { onUndo: () => void }) {
  const { dispatchToast } = useToastController();
  return (
    <Button
      onClick={() =>
        dispatchToast(
          <Toast status="success">
            <Toast.Title
              action={
                <Toast.Close>
                  <Button size="small" appearance="transparent" onClick={onUndo}>
                    Undo
                  </Button>
                </Toast.Close>
              }
            >
              Email sent
            </Toast.Title>
            <Toast.Body subtitle="To 3 people">Your message was delivered.</Toast.Body>
          </Toast>,
        )
      }
    >
      Send
    </Button>
  );
}

export function App({ undoSend }: { undoSend: () => void }) {
  return (
    <Toaster
      position="bottom-end"
      shortcuts={{ focus: (event) => event.altKey && event.shiftKey && event.code === 'KeyN' }}
    >
      <SendButton onUndo={undoSend} />
    </Toaster>
  );
}
```

`dispatchToast` returns the toast's id; `dismissToast(id)` removes the toast and `dismissAllToasts()` every toast. The 0.5 form builds a toast from text: `dispatchToast({ status: 'success', title: 'Saved', body: 'Your changes are saved.' })`. A plain object is read as options; anything else (an element, a string, an array) is content.

- **Parts.** `Toast.Title` holds the title text, which names the toast, and an `action` at the end of its row; `Toast.Body` holds the body text and a `subtitle`, which describe it; `Toast.Footer` is a row of actions below. Make them direct children of `Toast` (plain children are the body, and the `title` prop renders a title, as in 0.5). `icon` replaces the status icon: only `undefined` keeps it, and `null` shows none. Flat names for Server Components: `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`.
- **`Toast.Close`** makes its single child dismiss the toast: it calls the Toast's `onDismiss` (when there is one), then dismisses the toast in the Toaster. Your `onClick` runs first, and `preventDefault()` keeps the toast. It also works in content without a `Toast`. Every Toast in a Toaster shows the Dismiss button as well.
- **Severity.** The rendered Toast's `status` sets the announcement's politeness (`error` is assertive, the others polite) and its spoken prefix ("Error:", translated with `statusLabel`). For content without a `Toast`, pass `status` (and `statusLabel`) in the options: `dispatchToast(<UploadProgress />, { status: 'info' })`. A `status` in the options that differs from the Toast's own warns in development, and the Toast's wins.
- **What is announced.** The Toaster reads each toast once, through permanent live regions that need no provider: the severity, the title, the body with its subtitle, then the labels of its actions ("Success: Email sent Your message was delivered. To 3 people Undo"), never the Dismiss button. Hidden text is skipped, and an image's `alt` is read. `announcement` in the options replaces everything but the severity, for a toast whose visible text is no good announcement (a progress toast). Dispatching the same `toastId` again replaces the toast and announces it again.
- **Timing.** A toast times out after 5 seconds (`timeout` in the options). Every toast pauses while the pointer or focus is anywhere in the toast region, and while the page is in the background (the window has lost focus, or the tab is hidden, also when the Toaster mounted there). A toast with an action (a button, a link or a field besides its Dismiss button) stays until it is dismissed: people who use a screen reader, a switch or voice control need time to reach it. Pass `timeout` to change that deliberately.
- **Keyboard.** `shortcuts.focus` returns `true` for the key press that moves focus to the newest toast; use a modifier (or let people change the shortcut), since a single-character shortcut fails WCAG 2.1.4. A focused toast is announced by its severity and title. Tab and Shift+Tab move through the toasts' controls; Escape dismisses every toast and returns focus to where it was (a tooltip or menu opened from a toast closes first); Delete or Backspace dismisses the focused toast and moves focus to the next one. An Escape in the toasts never closes a Dialog below them: the next Escape does, once focus is back in the dialog.
- Toasts stay reachable by Tab over an open Dialog and move out of an open Drawer's way. `statusLabel` and `dismissLabel` (props of `<Toast>`; `statusLabel` is also an option of both `dispatchToast` forms, `dismissLabel` of the text form) translate the hidden status text and the Dismiss button's name.
- **`limit`** caps how many toasts show at once (`<Toaster limit={3}>`). Further toasts wait in a queue, in dispatch order, and appear as shown toasts go; a waiting toast is not announced and its timer does not run until it shows. A dismissed toast stops counting at once, also while an exit motion of yours runs. Lowering the limit never hides a shown toast. A value below 1 counts as 1 (with a development warning), and a fraction rounds down. Dispatching the id of a waiting toast again replaces it and keeps its place; `dismissToast(id)` removes a waiting toast silently.
- **`dismissAllToasts()`** removes every toast, shown and waiting, and cancels their timers. When focus was in a toast, it returns to the element that had it before.
- **Motion.** Each toast mounts through the presence core inside a container with the class `wave-toaster__toast`: style its `data-presence` phases for an enter and exit motion of yours (see [Enter and exit motion](#enter-and-exit-motion)). A dismissed toast stays mounted and `inert` until the exit ends; focus has already moved on. Wave ships no toast motion.

**Toasts from code outside components.** A query cache, an event handler or a helper module cannot call a hook. Create a handle with `createToaster()` at module scope and bind a Toaster to it:

```tsx
import * as React from 'react';
import { Toast, Toaster, createToaster } from '@mortenbrudvik/waveui';

/** Module scope is safe: on the server a dispatch does nothing. */
export const toaster = createToaster();

/** Callable from anywhere: a query cache's onError, an event handler, a helper. */
export function notifyUploadFailed(message: string) {
  return toaster.dispatchToast(
    <Toast status="error">
      <Toast.Title>Upload failed</Toast.Title>
      <Toast.Body>{message}</Toast.Body>
    </Toast>,
  );
}

export function Notifications({ children }: { children: React.ReactNode }) {
  return <Toaster toaster={toaster}>{children}</Toaster>;
}
```

A handle's toasts get everything above (the announcements, the pausing, `limit`, the focus handling, the Drawer offset, reachability over modals), and their content reads React context from where the Toaster is mounted, so a router link works. Dispatches before a Toaster binds wait in the handle's queue and show once it binds; `dispatchToast` returns the id at once, so `dismissToast(id)` also removes a waiting toast. After the Toaster unmounts, the handle queues again until the next one binds. A handle binds one Toaster (a second one does not bind, and warns in development): give each Toaster its own handle to run several (Fluent's `toasterId`). `useToastController()` keeps working inside a bound Toaster. Keep notifications in the Toaster rather than in an area of your own: an open modal `Dialog` or `Drawer` makes the rest of the page `inert`, so your own area would take no clicks, drop out of the accessibility tree and sit under the dialog, while the Toaster's region stays usable over modals.
````

- [ ] **Step 12: Add "Message bars" after "Toasts"**

Insert directly above `### Badges`:

````markdown
### Message bars

```tsx
import { Button, MessageBar } from '@mortenbrudvik/waveui';

export function UpdateNotice({ onUpdate, onLater }: { onUpdate: () => void; onLater: () => void }) {
  return (
    <MessageBar status="warning" onDismiss={onLater}>
      <MessageBar.Title>Update available</MessageBar.Title>
      A new version is ready to install.
      <MessageBar.Actions>
        <Button size="small" onClick={onUpdate}>
          Update now
        </Button>
        <Button size="small" appearance="subtle" onClick={onLater}>
          Later
        </Button>
      </MessageBar.Actions>
    </MessageBar>
  );
}
```

- **Parts.** `MessageBar.Title` is a semibold lead-in, read right after the severity; `MessageBar.Actions` holds buttons (Retry, Learn more) after the text. Both are direct children of the bar (Fragments count, and so do the flat `MessageBarTitle` and `MessageBarActions` written in a Server Component); one inside a component of yours renders where it is and warns in development. The built-in Dismiss button (`onDismiss`) stays the bar's own, after the actions.
- **Layouts.** `layout="singleline"` keeps the actions on the text's row, `"multiline"` puts them on a row of their own under the text, and `"auto"` (the default) keeps them on the text's row while the text fits on one line and moves them below when it does not (measured after mount with a ResizeObserver; the server renders one row). No layout cuts text off: on one row it wraps inside its column. The DOM order is the same in every layout (icon, text, actions, Dismiss), so a reflow never moves the focused button, and the Tab order is the text's links, the actions, the Dismiss button. A bar without actions looks as in 0.7. The root carries `data-layout` with the layout in use (`singleline` or `multiline`).
- **Names.** With its default role (`alert` for warnings and errors, `status` otherwise) the bar is a live region, and its title is read as the start of its content, once: "Warning: Update available A new version is ready to install.", then the actions' labels. A notice that stays on the page can take `role="region"`: then the title names the bar ("Warning: Update available"), which makes it a landmark; such a bar needs a title or an `aria-label` (a development warning says so). A consumer `aria-label` or `aria-labelledby` always wins.
````

- [ ] **Step 13: Add "Trees" after "Sorting and selecting in a DataGrid"**

Insert directly above `### Slots`:

````markdown
### Trees

```tsx
import * as React from 'react';
import { Button, Tree } from '@mortenbrudvik/waveui';

export function FileTree() {
  const [checked, setChecked] = React.useState<string[]>(['docs']);
  return (
    <Tree
      aria-label="Files"
      selectionMode="multiple"
      checkedItems={checked}
      onCheckedItemsChange={setChecked}
    >
      <Tree.Item value="docs" aside="3 files">
        Documents
        <Tree.Item value="cv">CV.pdf</Tree.Item>
        <Tree.Item value="letter">Letter.docx</Tree.Item>
        <Tree.Item value="notes">Notes.txt</Tree.Item>
      </Tree.Item>
      <Tree.Item
        value="photos"
        actions={
          <Button size="small" appearance="subtle">
            Share
          </Button>
        }
      >
        Photos
        <Tree.Item value="beach">Beach.jpg</Tree.Item>
      </Tree.Item>
    </Tree>
  );
}
```

- **Selection modes.** `selectionMode` is `'none'` (the default: activation only, and `selected` highlights one item), `'single'` (a radio indicator on every item for `selected`/`onItemSelect`; pass `selected`, a development warning asks for it) or `'multiple'` (a checkbox on every item, bound to `checkedItems` or `defaultCheckedItems`; Fluent's `'multiselect'`). The root carries `data-selection-mode`.
- **Checks cascade.** Checking an item checks it and all its descendants; unchecking does the reverse. A parent shows checked when all its descendants are checked, mixed when some are and unchecked when none are, and a listed parent also checks children that load later. `onCheckedItemsChange(checkedItems, details)` fires only on change, with a new array: every checked item in tree order (fully checked parents included, mixed ones not), then the listed values that match no item, unchanged, so values filtered out of the tree are not lost. `details` gives the toggled item's `value`, its new `checked` state and the DOM `event` (typed optional until 1.0).
- **Lazy children.** A "Loading…" placeholder item is an item like any other: checking its parent lists its value too, and once the real children replace it, that value matches no item and stays in the list. Drop it from your state when the children arrive (a listed parent keeps checking them).
- **Keys and clicks.** In a checkbox tree Space toggles the focused item and Enter activates it (`onItemSelect`); a click on the checkbox toggles, and a click elsewhere on the row activates. The checkbox is a real `role="checkbox"` named by the item, outside the Tab order, so touch screen readers and voice control reach it too. `*`, `current` and typeahead work as before (a Space typed within 500 ms of a letter continues the search).
- **Row content.** `Tree.Item` takes `actions` (buttons at the end of the row, in a toolbar named by the item; shown while the row is hovered or has focus, and always in forced colors and on devices without hover), `aside` (a count or badge at the end of the row, part of the item's description; it gives way to the actions on hover and focus), `iconAfter` (decorative, after the label) and `expandIcon` (replaces the chevron: `null` or `undefined` keep it, `false` hides it, and `aria-expanded` still reports the state). Keys and clicks on the actions never activate, check or expand the item. Give an icon-only action an `aria-label`.
- **Navigation modes.** With `navigationMode="tree"` (the default), Tab from the focused item enters its actions (one stop; the arrow keys move inside them) and Shift+Tab returns. With `"treegrid"`, the "next" arrow (Right, Left in RTL) moves into the actions of an expanded parent or a leaf (a collapsed parent still expands first), "previous" returns, and Up and Down move between items from an action; the actions then take no Tab stop. This replaces APG's "next on an open item moves to its first child" (Down does that). The roles stay `tree` and `treeitem` in both modes, as in Fluent.
- **Persona rows.** `Tree.ItemPersonaLayout` (flat `TreeItemPersonaLayout`, Fluent's name) lays out an item's label as a person: `media` (an Avatar of size 32 fits a row), the name as children and a `description` under it; the item is named by the name and described by the description.
````

- [ ] **Step 14: Slots and Built-in text**

In "Slots", replace the two kind bullets:

```markdown
- **Optional indicators** (`MenuButton.menuIcon`, the `expandIcon` of Combobox, TimePicker and `Tree.Item`): `null` or `undefined` keep the default glyph; `false` or any value that renders nothing hides it (for Combobox and TimePicker, the whole expand button).
```

```markdown
- **Status icons** (`MessageBar.icon`, `Toast.icon`, Field `validationMessageIcon`): only `undefined` keeps the default icon; `null` or a value that renders nothing shows none.
```

In "Built-in text", replace the `ColorPicker` row and add three rows after it:

```markdown
| `ColorPicker`               | `labels` (the 0.7 strings, plus `area` (the name of a bound area's group, "Saturation and brightness"), `saturation`, `brightness`, `roleDescription`, `hue`, `transparency`, `colorName(color)` and `valueText(color, channel)` for bound parts) |
| `ColorArea`                 | `labels` (`saturation`, `brightness`, `roleDescription` ("2D slider"), `colorName(color)`, `valueText(color, channel)`)                                            |
| `ColorSlider`               | `labels` (`hue`, `saturation`, `brightness` (the `value` channel), `colorName(color)`, `valueText(color, channel)`)                                              |
| `AlphaSlider`               | `labels` (`opacity`, `transparency`, `valueText(color, transparency)`)                                                                                            |
```

Replace the `MessageBar`, `Toast` row:

```markdown
| `MessageBar`, `Toast`       | `statusLabel` (the hidden severity text; also an option of both `dispatchToast` forms); `Toast` also `dismissLabel` (also an option of the text form)              |
```

Replace the last paragraph of the section (`0.7 adds no built-in text: …`) with:

```markdown
0.7 and 0.8 add no other built-in text: the submenu half of a `Menu.SplitGroup`, a context menu (`Menu.Popover`) and a `Toolbar.RadioGroup` are named by the `aria-label` you pass, a toast's container by its severity and title, and a tree row's actions toolbar by its item's label.
```

If Task D1 Step 5 found `TreeLabels`, add the row `| \`Tree\` | \`labels\` (\`checked\`, \`mixed\`, \`unchecked\`: the hidden state text of a checkbox tree's items) |` after the `ColorPicker`-family rows.

- [ ] **Step 15: Keyboard support and Hooks and utilities**

Replace `As implemented in 0.7.` with `As implemented in 0.8.` Replace the `Tree` row and add three rows after the `Slider` row:

```markdown
| Tree                            | One Tab stop. Up/Down, Home/End; Right expands or moves to the first child, Left collapses or moves to the parent (mirrored in RTL); Enter activates; Space activates, or in a checkbox tree (`selectionMode="multiple"`) toggles the focused item's check; `*` expands siblings; type to jump (a Space within 500 ms of a letter continues the search). Row actions: Tab from the focused item enters them and Shift+Tab returns (`navigationMode="tree"`); with `navigationMode="treegrid"` the "next" arrow moves into them (on an expanded parent too, instead of to its first child), "previous" returns, and Up/Down move between items. |
| Toaster                         | The app's `shortcuts.focus` key press focuses the newest toast; Tab and Shift+Tab move through the toasts' controls; Escape dismisses every toast and returns focus (a tooltip or menu of a toast closes first); Delete or Backspace dismisses the focused toast. |
| ColorArea                       | One Tab stop. Left/Right change saturation (mirrored in RTL), Up/Down brightness; Shift with an arrow by 10; PageUp/PageDown brightness by 10; Home/End saturation to 0/100. |
| ColorSlider, AlphaSlider        | The arrows of their axis by 1 (mirrored in RTL when horizontal), Shift with an arrow by 10, PageUp/PageDown by 10, Home/End to the minimum/maximum. |
```

In "Hooks and utilities", replace the `useRovingTabIndex(options)` and `useToastController()` rows, and add three rows before `cn(...classes)`:

```markdown
| `useRovingTabIndex(options)`                                                    | Roving tab stop and arrow-key navigation for composite widgets; items marked `data-disabled-focusable` stay reachable, a composite marked `data-roving-transparent` (a toolbar radio group) adds its items to the enclosing arrow order, and `tabStop: 'none'` leaves every item out of the Tab order (a composite reached by arrow keys only). |
| `useToastController()`                                                          | `dispatchToast` (content or options) / `dismissToast` / `dismissAllToasts` inside `<Toaster>`.                                                                                                                                                                       |
| `createToaster()`                                                               | A toast controller for code outside components; bind it with `<Toaster toaster={handle}>` (see [Toasts](#toasts)). Server-safe.                                                                                                                                      |
| `hsvToHex(color)`, `hexToHsv(hex)`                                              | Convert between an `HsvColor` and a hex string (`#rrggbb`, or `#rrggbbaa` below full opacity); `hexToHsv` returns `null` for other text. Server-safe.                                                                                                              |
| `buttonClassNames`, `toastTitleClassNames`, …                                   | The stable class names of every component and part (see [Styling hooks](#styling-hooks)). Server-safe.                                                                                                                                                             |
```

- [ ] **Step 16: Upgrading sections and their CHANGELOG anchors**

Insert directly above `## Upgrading from 0.6`:

```markdown
## Upgrading from 0.7

0.8 removes nothing public; these changes can still affect your tests and styles:

1. Every component root and part carries a stable class (`wave-button`, `wave-button__icon`, …): assertions on a complete class string change.
2. A toast in a Toaster renders inside a `role="group"` container named by its severity and title, which now carries `data-wave-toast` and `data-presence`; the 0.5 `title` and body render as the `Toast.Title` and `Toast.Body` elements.
3. Escape inside the toast region dismisses the toasts and no longer closes a Dialog or Drawer below them.
4. Every toast pauses while the pointer or focus is anywhere in the toast region (0.7 paused the hovered or focused toast only).
5. A toast dispatched with content that holds an action stays until it is dismissed, unless the dispatch passes `timeout`; the options form is unchanged.
6. MessageBar renders `data-layout`, and Tree `data-selection-mode`.
7. The default ColorPicker gains a color area and a hue slider, its opacity slider becomes an alpha slider (still named "Opacity"), and ColorPicker `children` now render a custom layout.
8. `ToastController['dispatchToast']` is overloaded: a test double that implements it must accept content too.

The CHANGELOG's [0.8.0 "Changed" section](CHANGELOG.md#changed) lists every behaviour, DOM and type change.
```

If the CHANGELOG's Upgrading list starts with the Dialog item (case B of Task D1), add this first and renumber the others from 2:

```markdown
1. `Dialog.Content`'s 1rem gap to the viewport is now the surface's own margin: a margin class of yours replaces it on its sides, a percentage width or height resolves against the whole viewport, and a surface you position with `fixed` or `absolute` needs `m-0`.
```

Then fix the two older links: in "Upgrading from 0.6", replace `[0.7.0 "Changed" section](CHANGELOG.md#changed)` with `[0.7.0 "Changed" section](CHANGELOG.md#changed-1)`; in "Upgrading from 0.5", replace `[0.6.0 "Changed" section](CHANGELOG.md#changed-1)` with `[0.6.0 "Changed" section](CHANGELOG.md#changed-2)`. In "Upgrading from 0.4", replace `then those of [Upgrading from 0.5](#upgrading-from-05) and [Upgrading from 0.6](#upgrading-from-06).` with `then those of [Upgrading from 0.5](#upgrading-from-05), [Upgrading from 0.6](#upgrading-from-06) and [Upgrading from 0.7](#upgrading-from-07).`

- [ ] **Step 17: Confirm every stated name against the code**

```bash
grep -n "export const buttonClassNames\|export const treeItemClassNames\|export const toastTitleClassNames" src/lib/classNames.ts
grep -n "root: 'wave-\(button\|toggle-button\|tree-item\|split-button\)'\|__icon'\|__primary-action-button'\|__menu-button'" src/lib/classNames.ts
grep -n "shortcuts?:\|toaster?:\|limit?:" src/components/feedback/Toaster.tsx
grep -n "timeout?:\|announcement?:\|statusLabel?:\|status?:" src/components/feedback/Toaster.tsx
grep -n "action?:\|subtitle?:\|asChild?:\|icon?:\|dismissLabel?:" src/components/feedback/Toast.root.tsx src/components/feedback/Toast.parts.tsx
grep -n "layout?:" src/components/feedback/MessageBar.tsx
grep -n "area?:\|colorName?:\|valueText?:\|roleDescription?:" src/components/input/ColorPicker.tsx src/components/input/ColorArea.tsx src/components/input/ColorSlider.tsx src/components/input/AlphaSlider.tsx
grep -n "'Saturation and brightness'\|'2D slider'\|'Hue'\|'Brightness'\|'Opacity'\|'Transparency'" src/components/input/ColorPicker.tsx src/components/input/ColorArea.tsx src/components/input/ColorSlider.tsx src/components/input/AlphaSlider.tsx
grep -n "selectionMode?:\|navigationMode?:\|actions?:\|aside?:\|iconAfter?:\|expandIcon?:\|media?:\|description?:" src/components/layout/Tree.core.tsx src/components/layout/Tree.itemPersonaLayout.tsx
grep -n "tabStop?:" src/hooks/useRovingTabIndex.ts
```

Compare each statement of Steps 3–16 with the output and the JSDoc around it; change the text where the code differs, and note it for the wave D report.

- [ ] **Step 18: Format, type-check the examples, check the links**

```bash
npx prettier --write README.md
npx prettier --check README.md
node node_modules/.cache/wave-docs/readme-examples.cjs README.md "Styling hooks" "Color" "Toasts" "Message bars" "Trees"
npx tsc -p tsconfig.dev.json --noEmit
node node_modules/.cache/wave-docs/readme-examples.cjs --clean
node node_modules/.cache/wave-docs/doclinks.cjs README.md CHANGELOG.md
git status --short
```

Expected: Prettier passes; the extractor writes 6 example files (Styling hooks 1, Color 1, Toasts 2, Message bars 1, Trees 1) and lists no skipped fragment; `tsc` exits 0 (a type error in `readme-example-<n>.check.tsx` points at the README line in the file's first comment: fix the README example, or the text around it, to the final API, and run the four commands again); `--clean` removes 6 files; the link check reports `0 problems`; `git status --short` lists only `README.md`.

- [ ] **Step 19: Commit**

```bash
git add README.md
git commit -m "docs(readme): Phase 3 components, styling hooks and usage notes"
```

---

### Task D3: CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` ("What is this?", Architecture, C-CLASS, C-COMPOSE, Styling, Testing)

**Interfaces:**
- Consumes: the final module list of waves B and C (the `ls` step).
- Produces: the conventions later phases follow (C-CLASS's stable-class rule).

- [ ] **Step 1: "What is this?"**

Replace `a React 19 component library of 65 components` with `a React 19 component library of 68 components`. Replace `(menus and commands, the presence core; its rulings are behind the 0.7 parts of C-CLASS, C-MOTION, C-NAMING and C-POPUPS below). Each later phase gets its own spec before work starts.` with:

```markdown
(menus and commands, the presence core; its rulings are behind the 0.7 parts of C-CLASS, C-MOTION, C-NAMING and C-POPUPS below), and the 0.8 design, `docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md` (notifications, color and trees, and the stable class names; its rulings are behind the 0.8 parts of C-CLASS and C-COMPOSE below). Each later phase gets its own spec before work starts.
```

- [ ] **Step 2: Architecture**

In the `src/components/<category>/` bullet:

1. After `\`unwrapButtonGlyph\` for the glyph slots of SplitButton, MenuButton and \`PickerExpandButton\`` insert `; \`withPartClass\` for a variant's icon class on Button's own icon span (ToggleButton, CompoundButton, MenuButton, SplitButton and the Toolbar buttons; \`Toolbar.parts.tsx\`'s \`withIconBox\` is built on it)`.
2. After `\`button/Toolbar.parts.tsx\` and \`button/Toolbar.context.ts\` (the Toolbar parts and their context)` insert `, \`MessageBar.parts.tsx\` (\`MessageBar.Title\`, \`MessageBar.Actions\` and the context that marks them placed) and \`MessageBar.reflow.ts\` (\`useMessageBarReflow\`), \`input/ColorPicker.parts.tsx\` (the picker context, which \`ColorArea\`, \`ColorSlider\` and \`AlphaSlider\` read to bind, and the \`HexField\`, \`Swatches\` and \`Preview\` parts; it never imports \`ColorPicker.tsx\`), \`input/colorName.ts\` (the English color namer of the value texts)`.
3. Append after the Menu split sentence (which ends with `` `Menu.splitGroup.tsx`. ``):

```markdown
Toast and Tree are split the same way, with one-way imports (nothing imports `Toast.tsx` or `Tree.tsx`, the compound modules that hold the `Object.assign(…)`, its JSDoc and the flat re-exports): `Toast.root.tsx` (the Toast visual), `Toast.parts.tsx` (Title, Body, Footer, Close), `Toast.context.ts` (the per-toast and Toaster contexts) and `Toaster.tsx` (the container, controller, timers, live regions, keyboard and the handle binding), with `Toast.tsx` also re-exporting `Toaster`, `useToastController` and the types the barrel imports; `Tree.core.tsx` (the root and `Tree.Item`, together because each recognises the other), `Tree.context.ts`, `Tree.selection.ts` (the pure cascade model) and `Tree.itemPersonaLayout.tsx`.
```

In the `src/hooks/` bullet, append after `(\`Toolbar.RadioGroup\`).`: ` Its \`tabStop: 'none'\` option leaves every item at \`tabIndex=-1\` (a composite reached by arrow keys only: a Tree row's actions).`

In the `src/lib/` bullet, replace `\`PopupTarget\`, \`VirtualElement\`, …; new props reuse them)` with `\`PopupTarget\`, \`VirtualElement\`, \`HsvColor\`, \`ColorPickerShape\`, …; new props reuse them)`, and replace `\`globalRegistry\` (singletons shared by ESM and CJS copies).` with:

```markdown
`globalRegistry` (singletons shared by ESM and CJS copies), `classNames` (the stable class-name registry: one `<name>ClassNames` constant per public component and part, `as const`, server-safe and exported from the entry), `color` (the public `hsvToHex` and `hexToHsv`, server-safe; `colorUtils.ts` builds on it), `toaster` (`createToaster`, the server-safe toaster handle; its binding to a Toaster is an internal export).
```

In the "Tests:" bullet, replace `(\`conventions.test.ts\`, \`stories.a11y.test.tsx\`, \`integration.test.tsx\`, \`public-types.test.ts\`, \`test-utils.test.tsx\`)` with `(\`conventions.test.ts\`, \`stories.a11y.test.tsx\`, \`integration.test.tsx\`, \`public-types.test.ts\`, \`classNames.test.ts\`, \`test-utils.test.tsx\`)`.

- [ ] **Step 3: C-CLASS and C-COMPOSE**

Append to the end of the **C-CLASS** bullet (after `ToggleButton always adds \`data-pressed\` while pressed.`):

```markdown
Every public component and part carries its stable class from `src/lib/classNames.ts` (`wave-<name>`, `wave-<name>__<part>`), first in its `cn()`, on the element that receives `className`, written as a literal member access (`buttonClassNames.root`); variants carry their base classes (a variant's icon through `withPartClass`), and a nested public component its parent's part class; no state classes; no class removed before 1.0. A new component or part registers its constant in the same change; the conventions gate (`class-names`) and `testSystemProps` enforce it.
```

Append to the end of the **C-COMPOSE** bullet:

```markdown
The Toaster's region-wide pause handlers are the one exception: they count focus and pointer events from a portal opened inside a toast on purpose (a menu opened from a toast keeps every timer paused), while its key and activation handlers keep the rule.
```

- [ ] **Step 4: Styling**

Add after the bullet that starts `- Never write a Tailwind utility name as a bare word`:

```markdown
- The stable classes (`wave-button`, `wave-button__icon`, from `src/lib/classNames.ts`) are hooks for consumers: the library never styles through them and Tailwind generates nothing for them. The registry is under `src/lib`, so its JSDoc follows the bare-word rule above (name elements by role, "the grid element").
```

- [ ] **Step 5: Testing**

Add after the bullet that starts `- \`testSystemProps(Component, {`:

```markdown
- `testSystemProps` also checks the stable classes: for a component with a registry constant, `testClassName` asserts that the element receiving the consumer's `className` carries the component's root class and the base classes of a variant (`getStableClassNames(displayName)` in `src/test-utils.ts`, with `DISPLAY_NAME_ALIASES` for display names that differ from their flat names and `VARIANT_BASES`). Assert a part's class with `toHaveClass(<constant>.<key>)`, reading the constant, never a literal.
```

Add after the bullet that starts `- Presence phases:`:

```markdown
- Toast containers mount through the presence core: `mockAnimations({ animated: (el) => el.hasAttribute('data-wave-toast') })` keeps a toast's phase waiting.
```

Add after the bullet that starts `- Hover:`:

```markdown
- Pointer drags (ColorArea): stub `setPointerCapture`, `releasePointerCapture` and `hasPointerCapture` on `Element.prototype` in a `beforeEach` (jsdom has none), give the field a box with `mockRect`, and dispatch `PointerEvent`s with `pointerType` in `act`. ResizeObserver-driven layout (the MessageBar reflow): `installResizeObserverMock`, stubbed `scrollWidth`/`clientWidth` and the mock's `trigger`; to prove that nothing is observed, spy on `ResizeObserver.prototype.observe` after installing the mock.
```

Add before the bullet that starts `- Cross-component compositions`:

```markdown
- Pending lists keep the gates green while a phase's parallel packages land: `PENDING_FLAT_EXPORTS` (`scripts/verify-dist.mjs`; `--final` requires it empty), `PENDING_CLASS_NAMES` (`src/__tests__/classNames.test.ts`), `PENDING_PUBLIC_TYPES` (`src/__tests__/public-types.test.ts`) and `PENDING_FLAT_MEMBERS` (the barrel test of `src/__tests__/integration.test.tsx`). The package that adds a compound member, a class-name constant or a public type fills them; INTEGRATION empties them.
```

- [ ] **Step 6: Confirm the files and names against the code**

```bash
ls src/components/feedback/Toast.tsx src/components/feedback/Toast.root.tsx src/components/feedback/Toast.parts.tsx src/components/feedback/Toast.context.ts src/components/feedback/Toaster.tsx src/components/feedback/MessageBar.parts.tsx src/components/feedback/MessageBar.reflow.ts
ls src/components/input/ColorArea.tsx src/components/input/ColorSlider.tsx src/components/input/AlphaSlider.tsx src/components/input/ColorPicker.parts.tsx src/components/input/colorName.ts
ls src/components/layout/Tree.tsx src/components/layout/Tree.core.tsx src/components/layout/Tree.context.ts src/components/layout/Tree.selection.ts src/components/layout/Tree.itemPersonaLayout.tsx
ls src/lib/classNames.ts src/lib/color.ts src/lib/toaster.ts src/__tests__/classNames.test.ts
grep -n "export function withPartClass" src/components/button/Button.slots.tsx
grep -n "withPartClass" src/components/button/Toolbar.parts.tsx
grep -n "export function useMessageBarReflow" src/components/feedback/MessageBar.reflow.ts
grep -n "export function getStableClassNames\|DISPLAY_NAME_ALIASES\|VARIANT_BASES" src/test-utils.ts
grep -n "PENDING_CLASS_NAMES" src/__tests__/classNames.test.ts
grep -n "PENDING_PUBLIC_TYPES" src/__tests__/public-types.test.ts
grep -n "export const PENDING_FLAT_EXPORTS" scripts/verify-dist.mjs
grep -n "PENDING_FLAT_MEMBERS" src/__tests__/integration.test.tsx
grep -n "'class-names'" src/__tests__/conventions.test.ts
```

Expected: every file exists and every grep prints a line. A different module name (a package split a file otherwise) changes the text of Step 2, not the code.

- [ ] **Step 7: Check the links and commit**

```bash
node node_modules/.cache/wave-docs/doclinks.cjs CLAUDE.md
git status --short
git add CLAUDE.md
git commit -m "docs(claude): Phase 3 modules, the stable-class rule and test recipes"
```

Expected: `0 problems`; `git status --short` lists only `CLAUDE.md` before `git add`.

---

### Task D4: Design guide and testing guide

**Files:**
- Modify: `docs/WAVE-UI-GUIDE.md` (Pattern 2's compound list; Pattern 10 (new, after Pattern 9); §9 Keyboard Navigation Patterns (Tree, Toaster, ColorArea), ARIA Patterns (Tree, Color area and sliders, Live Regions), Focus Management, Forced Colors, Screen Reader Best Practices; §11 Feedback Patterns and Component Selection Guide; §12 catalog, Key File Paths, Keyboard Pattern Cheat Sheet; §13)
- Modify: `docs/testing-best-practices.md` (§3; §5 new subsections after "Browser API mocks"; §11)

**Interfaces:**
- Consumes: the final API and test helpers (grep step).
- Produces: `#pattern-10-stable-class-names` (guide), the §5 subsections of the testing guide.

- [ ] **Step 1: Guide — Pattern 2 compound list**

In the paragraph that starts `Compound components: \`Accordion\`,`, replace `\`Breadcrumb\`, \`Card\`, \`Carousel\`, \`Combobox\`,` with `\`Breadcrumb\`, \`Card\`, \`Carousel\`, \`ColorPicker\`, \`Combobox\`,`, `\`List\`, \`Menu\`, \`Nav\`,` with `\`List\`, \`Menu\`, \`MessageBar\`, \`Nav\`,` and `\`TabList\`, \`Table\`, \`Toolbar\`, \`Tree\`.` with `\`TabList\`, \`Table\`, \`Toast\`, \`Toolbar\`, \`Tree\`.`

- [ ] **Step 2: Guide — Pattern 10**

Insert directly above `### Props Interface Conventions`:

````markdown
### Pattern 10: Stable Class Names

Every public component and compound part carries a stable class, registered in `src/lib/classNames.ts` and exported from the package entry. A new component registers its constant in the same change:

```tsx
// src/lib/classNames.ts (server-safe: no imports)
/** Stable class names of Chip: `root` on the `<button>`, `icon` on the icon box. */
export const chipClassNames = {
  root: 'wave-chip',
  icon: 'wave-chip__icon',
} as const;
```

```tsx
// src/components/button/Chip.tsx
import { chipClassNames } from '../../lib/classNames';

export const Chip = ({ icon, className, ref, children, ...rest }: ChipProps) => (
  <button
    type="button"
    ref={ref}
    className={cn(chipClassNames.root, 'rounded-md border border-stroke px-3 py-1', focusRing, className)}
    {...rest}
  >
    {renderSlot(icon, 'span', cn(chipClassNames.icon, 'inline-flex size-4'), { 'aria-hidden': true })}
    {children}
  </button>
);
Chip.displayName = 'Chip';
```

- **Names.** The root class is `wave-` and the kebab-cased flat export name (`CardHeader` → `wave-card-header`); a part class is `<root>__<kebab part key>`; the constant is the camel-cased flat name plus `ClassNames`, with camelCase keys and `as const`. `WaveProvider` (`wave-root`) and `Portal` (`wave-portal`) keep their scope classes. A component that renders no element of its own (Dialog, Popover, Presence, the trigger and close parts that clone their child) has no constant; an alias shares its target's (`ComboboxOption` uses `optionClassNames`).
- **Placement.** The root class goes first in the `cn()` of the element that receives `className`, so the consumer's class still comes last. A part is an element the component renders that a prop or slot fills or controls (icon, dismiss button, expand icon, checkmark, secondary text, validation message) or visible structure (track, thumb, rail, surface, header, footer); hidden inputs, visually hidden text, live regions and layout wrappers are not parts. A slot part passes its class in `renderSlot`'s base classes, so it stays when a slot object swaps the element. Never apply a stable class inside a shared style helper (`buttonClassName()`, `menuItemClasses`): elements that are not that component use those helpers too. Note the one letter between the public `buttonClassNames` and the internal `buttonClassName()`.
- **Variants and nesting.** A variant lists the base constant first: `cn(buttonClassNames.root, toggleButtonClassNames.root, …)`. A variant that renders Button hands its icon class over with `withPartClass(icon, toggleButtonClassNames.icon)` (`Button.slots.tsx`), which wraps the slot so that Button's own icon span carries both classes; Button gains no prop. A public component rendered inside another gets the parent's part class through its `className`: `<Button {...menuButtonProps} className={cn(splitButtonClassNames.menuButton, menuButtonProps?.className)} />`.
- **Literal member access.** Write each member you apply literally (`toggleButtonClassNames.root`, never `names[kind].root`), also when a shared renderer draws the element: the menu item kinds pass `rootClassName={cn(menuItemClassNames.root, menuItemCheckboxClassNames.root)}` to `MenuItemRow`. The gate and the registry test find the constants by that text.
- **No state classes.** State stays in `data-*` attributes and ARIA (C-CLASS).
- **Enforcement.** The conventions gate's `class-names` rule fails a module that sets a registered component's `displayName` without applying its constant's `root`; `testSystemProps` asserts the root classes where `className` lands; `src/__tests__/classNames.test.ts` checks that every public component has a constant (or is on its no-element list), that every constant follows the formula, that every key is applied somewhere in `src/components`, and that the entry exports every constant; `verify-dist` checks that the entry exports them with the same values, that a Server Component can read them, and that an import of only Button keeps `'wave-button'` and drops other components' classes.
- **Stability.** The names are public API: no class is removed before 1.0. A renamed part, or a part that becomes a compound member of its own, keeps its old class next to the new one until 1.0; moving a class to another element is a CHANGELOG "Changed" DOM entry.
- **Words.** The registry is under `src/lib`, which Tailwind scans: its JSDoc names elements by role ("the grid element"), never with a utility name as a bare word ([Pattern 5](#pattern-5-cn-utility)).
````

- [ ] **Step 3: Guide — keyboard patterns**

Replace the code block and the paragraph under `#### Tree` (in "Keyboard Navigation Patterns") with:

````markdown
```
Tab                  → enters at the selected item, else the first
ArrowDown / ArrowUp  → next / previous visible item
ArrowRight           → expand, or move to the first child (mirrored in RTL); with
                       navigationMode="treegrid", into the item's actions instead (a collapsed
                       parent still expands first)
ArrowLeft            → collapse, or move to the parent (mirrored in RTL); from the first action
                       (treegrid), back to the item
Home / End           → first / last visible item
Enter                → activate (onItemSelect) and toggle a parent
Space                → activate; in a checkbox tree (selectionMode="multiple"), toggle the check
*                    → expand all siblings
Printable characters → jump to the next item starting with the text
Tab (on an item)     → into its actions (navigationMode="tree"); Shift+Tab back
```

Nested items are `Tree.Item` elements in their parent's children: directly, in Fragments or from a render function (`children.map(renderNode)`). A `Tree.Item` rendered by a recursive component is not part of its parent's group (a development warning names it). `value`s are unique (a duplicate warns). `leaf` renders an item as a leaf even when it has nested items; an item is expandable only while it has nested items, so for children loaded on first expansion give it a placeholder child ("Loading…") until they arrive.

**Checkbox trees.** With `selectionMode="multiple"`, Space toggles the focused item's check (a Space that continues a typeahead search stays typeahead) and Enter still activates it. Checks cascade: toggling an item sets it and all its descendants, and a parent is checked, mixed or unchecked from its descendants. A click on the row's checkbox toggles; a click elsewhere on the row activates.

**Row actions.** An item's `actions` render in a toolbar of the row. With `navigationMode="tree"`, the toolbar's buttons rove with `useRovingTabIndex` and hold one Tab stop while their item is the tree's active item, so Tab from the item enters them and Shift+Tab returns; with `navigationMode="treegrid"` they take no Tab stop, the "next" arrow enters them, "previous" from the first action returns, "next" and "previous" move between actions without wrapping, and Up and Down move to the previous or next item. Keys and clicks inside the actions are theirs: the item ignores them (no activation, check, expansion or typeahead), and an action that handles an arrow key itself (a MenuButton opening its menu on ArrowDown) keeps it.
````

Insert directly above `#### DataGrid` (in "Keyboard Navigation Patterns"):

````markdown
#### Toaster

```
App shortcut (shortcuts.focus) → focus the newest toast (a named group)
Tab / Shift+Tab                → through the toasts' controls
Escape                         → dismiss every toast; focus returns to where it was
Delete / Backspace             → dismiss the focused toast; focus moves to the next one
```

The Toaster's region takes Escape only when the key is pressed inside the region in the DOM (a key pressed in a Menu, Popover or Dialog opened from a toast reaches the region through the React tree and is left alone) and when no open, Escape-enabled dismiss layer is anchored inside it (a Tooltip on a toast's button, a Menu opened from a toast closes first). It then prevents the default, so the dismiss-layer stack never routes that Escape to a Dialog or Drawer below the toasts, returns focus to the element focused before focus entered the toasts, and dismisses them. Delete and Backspace act on the focused toast container or a control inside it, except in an editable field. A dismissed toast moves focus in the dismissing commit: to the next toast that is not exiting (its container, when focus was on the container), else the previous one, else the remembered origin. The pointer or focus anywhere in the region pauses every toast's timer.

#### ColorArea (2-D slider)

```
Tab                    → one stop (the input used last; saturation at first)
ArrowLeft / ArrowRight → saturation −1 / +1 (mirrored in RTL)
ArrowDown / ArrowUp    → brightness −1 / +1
Shift + arrow          → by 10
PageDown / PageUp      → brightness −10 / +10
Home / End             → saturation 0 / 100
```

The area holds two visually hidden native range inputs, saturation and brightness; focus, and the Tab stop, follow the axis that changed, so the channel that changed is announced. Unless the primary pointer is coarse (`(pointer: coarse)`: a touch device), the other input is `tabIndex=-1` and `aria-hidden`, so desktop screen readers meet one 2-D slider (the server renders this model too); on touch devices both stay exposed, so a touch screen reader can swipe each. A pointer press jumps and drags with pointer capture. `ColorSlider` and `AlphaSlider` are one native range input each, with the same keys on their axis.
````

- [ ] **Step 4: Guide — ARIA patterns**

Replace the code block and the sentence under `#### Tree` (in "ARIA Patterns") with:

````markdown
```html
<div role="tree" aria-label="Files" aria-multiselectable="true" data-selection-mode="multiple">
  <div role="treeitem" aria-expanded="true" aria-checked="mixed" aria-labelledby="label-docs">
    <div>
      <span role="checkbox" aria-checked="mixed" tabindex="-1" aria-labelledby="label-docs"></span>
      <span id="label-docs">Documents</span>
      <span role="toolbar" aria-labelledby="label-docs" aria-orientation="horizontal">…</span>
    </div>
    <div role="group">
      <div role="treeitem" aria-checked="true" aria-labelledby="label-cv">…</div>
    </div>
  </div>
</div>
```

Each treeitem contains its label row and its child group, and is named by its label (not by its icon or nested items). In a checkbox tree (`selectionMode="multiple"`) every item carries `aria-checked` (`mixed` for a partly checked parent) and never `aria-selected` (APG: one or the other); the row's checkbox is an exposed `role="checkbox"` with the same state, outside the Tab order and labelled by the item, so touch screen readers and voice control can change a check (a decorative indicator would leave them only the item's activation, WCAG 4.1.2). In a single-selection tree every item carries `aria-selected` and the radio is decorative. A row's actions are a `role="toolbar"` named by the item's label, an `aside` joins the item's `aria-describedby`, and a `Tree.ItemPersonaLayout` names the item by the person's name and describes it by the description. `navigationMode="treegrid"` changes the keyboard only: the roles stay `tree` and `treeitem`, because a real treegrid needs one flat list of rows with `aria-level`.
````

Insert directly above `#### Live Regions (Toasts, Status)`:

````markdown
#### Color area and sliders

```html
<div role="group" aria-labelledby="field-label">
  <div aria-hidden="true"><!-- the gradient field --></div>
  <input type="range" min="0" max="100" value="72" aria-label="Saturation"
         aria-roledescription="2D slider" aria-valuetext="Saturation 72%, Brightness 74%, dark blue" />
  <input type="range" min="0" max="100" value="74" aria-label="Brightness"
         aria-roledescription="2D slider" aria-orientation="vertical"
         aria-valuetext="Brightness 74%, Saturation 72%, dark blue" tabindex="-1" aria-hidden="true" />
</div>
```

Each value text starts with its own channel, so the value that changed is heard first, and ends with the color's name (a built-in English namer that `labels.colorName` replaces). A group supports neither `aria-invalid` nor `aria-errormessage`, so both inputs get them. A `ColorSlider` says "210°, blue" (hue) or "72%", an `AlphaSlider` "40%"; a vertical slider is a horizontal input turned a quarter turn, with `aria-orientation="vertical"`.
````

Replace the paragraph under `#### Live Regions (Toasts, Status)` (the one that starts `Live regions must exist before their content changes.`) with:

```markdown
Live regions must exist before their content changes. `Toaster` keeps two permanent, visually hidden regions (polite, and assertive for `error` toasts) and adds each toast to one of them once, as text: the severity, the title, the body with its subtitle and the labels of its actions (never the Dismiss button). The toast itself is a `role="group"` container named by its severity and title, described by its body and focusable by the shortcut (`tabIndex="-1"`, no Tab stop), not a live region; a `Toast` rendered outside a Toaster is its own live region, with no name. A MessageBar with its default role (`alert` for warnings and errors, `status` otherwise) is a live region that its title does not name, because a named live region can have its name read with its content, which would read the title twice: the title is read as the first words of the content. With a non-live `role="region"` or `"group"`, the title names the bar through `aria-labelledby` (the severity text, then the title). Use `announce(message, politeness?)` or `useAnnounce()` for your own announcements; they go through a shared region that modal isolation never makes inert.
```

- [ ] **Step 5: Guide — focus, forced colors, screen readers**

In "Focus Management", item 3, replace `(a SearchBox clear button, a removed toast, a boundary button)` with `(a SearchBox clear button, a dismissed toast, a boundary button)`.

In "Forced Colors", replace `PresenceBadge and the Button family` with `PresenceBadge, ColorArea, ColorSlider and AlphaSlider (the field and the rails keep their colors with \`forced-color-adjust: none\` on those elements only; the thumbs draw their ring and focus indicator in \`CanvasText\`, \`Canvas\` and \`Highlight\`), the Tree checkbox and radio indicators (Checkbox's recipe) and the Button family`.

In "Screen Reader Best Practices", last bullet, replace `and the \`labels\` objects of ColorPicker, Combobox,` with `and the \`labels\` objects of AlphaSlider, ColorArea, ColorPicker, ColorSlider, Combobox,`. If Task D1 Step 5 found `TreeLabels`, also add `Tree,` after `TimePicker and` in that list and put `Tree` in its alphabetical place.

- [ ] **Step 6: Guide — feedback patterns and component selection**

Replace the first code block of "Feedback Patterns" (the `SaveButton` toast example) with:

````markdown
```tsx
import { Button, Toast, Toaster, useToastController } from '@mortenbrudvik/waveui';

function SaveButton({ onUndo }: { onUndo: () => void }) {
  const { dispatchToast } = useToastController();
  return (
    <Button
      onClick={() =>
        dispatchToast(
          <Toast status="success">
            <Toast.Title
              action={
                <Toast.Close>
                  <Button size="small" appearance="transparent" onClick={onUndo}>
                    Undo
                  </Button>
                </Toast.Close>
              }
            >
              Saved
            </Toast.Title>
            <Toast.Body>Your changes have been saved.</Toast.Body>
          </Toast>,
        )
      }
    >
      Save
    </Button>
  );
}

export function App({ undo }: { undo: () => void }) {
  return (
    <Toaster position="bottom-end">
      <SaveButton onUndo={undo} />
    </Toaster>
  );
}
```
````

Replace the paragraph under it (starting `A sibling \`<Toaster />\` does not work`) with:

```markdown
A sibling `<Toaster />` does not work: `useToastController()` outside a Toaster throws in development (from code outside components, dispatch through a `createToaster()` handle bound with `<Toaster toaster={handle}>`). Every toast pauses while the pointer or focus is anywhere in the toast region and while the page is in the background, and a toast with an action (the Undo above) stays until it is dismissed unless the dispatch passes `timeout`. The rendered Toast's `status` sets the announcement's politeness and prefix. `statusLabel` translates the hidden status text; `<Toaster limit={3}>` shows at most three toasts and queues the rest (a queued toast is not announced and does not count down until it shows); `dismissAllToasts()` from the controller removes every toast. The text form `dispatchToast({ status, title, body })` still works.
```

In "Component Selection Guide", replace the rows `| Pick a color | \`ColorPicker\`, \`SwatchPicker\` |` and `| Notify users | \`Toast\` / \`Toaster\`, \`MessageBar\` |` with:

```markdown
| Pick a color | `ColorPicker`, `ColorArea`, `ColorSlider`, `AlphaSlider`, `SwatchPicker` |
| Notify users | `Toast` / `Toaster` (`createToaster()` from outside components), `MessageBar` |
```

- [ ] **Step 7: Guide — quick reference and 1.0 notices**

Replace `### Component Catalog (65 components)` with `### Component Catalog (68 components)`. Replace the "Input & Forms" paragraph pair with:

```markdown
**Input & Forms** (22)
`Input` `Textarea` `Field` `Label` `Checkbox` `RadioGroup` `Switch` `Select` `SearchBox` `Slider` `SpinButton` `Combobox` `Dropdown` `TagPicker` `Rating` `ColorPicker` `ColorArea` `ColorSlider` `AlphaSlider` `SwatchPicker` `DatePicker` `TimePicker` (plus `RadioGroup.Item`/`RadioItem`, `Option`/`OptionGroup`, `RatingDisplay` and the ColorPicker parts `ColorPicker.HexField`, `ColorPicker.Swatches`, `ColorPicker.Preview`)
```

Replace the "Layout" and "Feedback" paragraph pairs with:

```markdown
**Layout** (9)
`Card` `Accordion` `TabList` `Tree` `Carousel` `Overflow` `Grid` `Stack` `Flex` (plus `Tree.ItemPersonaLayout`)
```

```markdown
**Feedback** (5)
`MessageBar` `ProgressBar` `Spinner` `Skeleton` `Toast`/`Toaster` (plus `MessageBar.Title`, `MessageBar.Actions`, `Toast.Title`, `Toast.Body`, `Toast.Footer`, `Toast.Close`)
```

In "Key File Paths", add these rows after the `src/lib/styles.ts` row:

```markdown
| `src/lib/classNames.ts` | The stable class-name registry (public, server-safe) |
| `src/lib/color.ts` | `hsvToHex`, `hexToHsv` (public, server-safe) |
| `src/lib/toaster.ts` | `createToaster`, the toaster handle (public, server-safe) |
| `src/components/feedback/Toast*.tsx`, `src/components/feedback/Toaster.tsx` | The Toast modules (compound, root, parts, context, the Toaster) |
| `src/components/layout/Tree*.ts(x)` | The Tree modules (compound, root and items, context, the cascade model, the persona layout) |
```

In "Keyboard Pattern Cheat Sheet", replace the Tree row and add two rows after it:

```markdown
| Tree | Tab (selected item) | Up/Down, Left/Right (collapse/expand), Home/End, typeahead; into a row's actions by Tab (`tree`) or Right (`treegrid`) | Enter/Space (Space toggles the check in a checkbox tree) | Tab |
| Toaster | the app's `shortcuts.focus` key press | Tab through the toasts' controls | Enter/Space on a control | Escape (all toasts) / Delete, Backspace (the focused one) |
| ColorArea | Tab (one stop) | Arrows, Shift+arrows, PageUp/PageDown, Home/End | – | Tab |
```

In "§13 Deprecated APIs", add at the end of the "Announced for 1.0" list:

```markdown
- The `details` parameter of Tree `onCheckedItemsChange` becomes required: read it as `details?.value`.
```

- [ ] **Step 8: Testing guide — §3 and §11**

In §3, replace the `testClassName` bullet with:

```markdown
- `testClassName(Component, props?, options?)` — every default class survives a consumer `className`; with `conflictingClass`, the consumer class wins and the default is gone; and, for a component with a stable class-name constant, the element that received the consumer class also carries the component's root class and the base classes of a variant (a ToggleButton: `wave-button` and `wave-toggle-button`). The last case is registered only when `getStableClassNames(displayName)` finds a constant (see [Stable class names](#stable-class-names-getstableclassnamesdisplayname)), and it looks the element up by the consumer class, so a component whose `className` lands on a wrapper or a portaled element (`RadioGroup.Item`'s label, a Dialog surface) needs no config change.
```

In §11, replace the conventions-gate bullet's list `\`<button>\` without \`type\`, and transitions or animations without a \`motion-reduce:\` variant.` with `\`<button>\` without \`type\`, transitions or animations without a \`motion-reduce:\` variant, and a module that sets a registered component's \`displayName\` without applying its class-name constant's \`root\` (\`class-names\`).`, and add after the `public-types.test.ts` bullet:

```markdown
- `src/__tests__/classNames.test.ts` — the class-name registry: every component-like export of the entry (and every compound member) has a constant or is on `NO_ELEMENT`; every constant follows the formula (`wave-<kebab name>`, `__<kebab part>`, no repeated string, no reserved scope class); every export is exported by the entry with the same value; the registry imports nothing; every value is applied as `<constant>.<key>` in some module of `src/components`, except the entries of `PENDING_CLASS_NAMES`, which a phase fills for the parts its parallel packages add and INTEGRATION empties. `public-types.test.ts` has the same kind of bridge, `PENDING_PUBLIC_TYPES`, for public types that become reachable before the barrels export them.
```

- [ ] **Step 9: Testing guide — §5 recipes**

Insert directly above `## 6. Controlled components and callbacks`:

````markdown
### Stable class names: `getStableClassNames(displayName)`

`getStableClassNames(displayName)` (`src/test-utils.ts`) returns `{ constant, root, carries }` for a component with a registry constant, else `undefined`: the constant's name (`toggleButtonClassNames`), its root class and every root class the element must carry, the base classes of a variant included (`VARIANT_BASES`). A display name that differs from its flat name is looked up through `DISPLAY_NAME_ALIASES` (`RadioItem` → `radioGroupItemClassNames`). `testClassName` uses it; assert part classes yourself, reading the constant:

```tsx
// src/components/button/__tests__/stableClassNames.test.tsx
import { render, screen } from '@testing-library/react';
import { ToggleButton } from '../ToggleButton';
import { buttonClassNames, toggleButtonClassNames } from '../../../lib/classNames';

it('puts both icon classes on the icon span', () => {
  render(<ToggleButton icon={<svg />} aria-label="Bold" />);
  const icon = screen.getByRole('button', { name: 'Bold' }).querySelector('span[aria-hidden]');
  expect(icon).toHaveClass(buttonClassNames.icon, toggleButtonClassNames.icon);
});
```

### Toasts

- **Dispatching content.** Render a Toaster and a button that dispatches (`useToastController()` inside it), or a handle from `createToaster()` created in the test (never at module scope of a test file, which would share it between tests). The toast's container is `getByRole('group', { name: 'Success: Email sent' })`; its parts carry their stable classes.
- **Announcements.** The Toaster's two permanent live regions receive each toast's text once: assert that text there (the severity, title, body and action labels, never "Dismiss"), and that an `error` toast lands in the assertive one. Nothing needs a provider.
- **Presence.** A toast's container mounts through the presence core: `mockAnimations({ animated: (el) => el.hasAttribute('data-wave-toast') })` keeps a dismissed toast `exiting` (and `inert`) until `motion.finishAll()`, so a test can check that focus moved to the next toast before the exit ends and that the exiting toast no longer counts toward `limit`.
- **The shortcut.** `shortcuts={{ focus: (event) => event.altKey && event.shiftKey && event.code === 'KeyN' }}` and `await user.keyboard('{Alt>}{Shift>}N{/Shift}{/Alt}')` from anywhere in the page; Escape and Delete go to the focused container (`act(() => container.focus())`).
- **Timers.** The fake-timer recipe of section 7. A toast with an action gets no timer unless the dispatch passes `timeout`: assert `vi.getTimerCount()` or that the toast is still there after the default 5 seconds.
- **Server rendering.** A test file with `// @vitest-environment node` can dispatch through a module-level handle (the dispatch returns an id and does nothing) and `renderToString` a page with a bound Toaster (no toast in the HTML).

### ResizeObserver layout: the MessageBar reflow

`layout="auto"` with `MessageBar.Actions` observes the bar. Install the mock, give the text column an overflow and trigger:

```tsx
// src/components/feedback/__tests__/MessageBar.reflow.test.tsx
import { render, screen } from '@testing-library/react';
import { MessageBar } from '../MessageBar';
import { messageBarClassNames } from '../../../lib/classNames';
import { installResizeObserverMock } from '../../../test-utils';

it('switches to the multiline layout while the text overflows', () => {
  const resizeObserver = installResizeObserverMock();
  try {
    render(
      <MessageBar data-testid="bar">
        A long message
        <MessageBar.Actions>
          <button type="button">Retry</button>
        </MessageBar.Actions>
      </MessageBar>,
    );
    const bar = screen.getByTestId('bar');
    const text = bar.querySelector(`.${messageBarClassNames.body}`) as HTMLElement;
    expect(bar).toHaveAttribute('data-layout', 'singleline');
    Object.defineProperty(text, 'scrollWidth', { configurable: true, value: 400 });
    Object.defineProperty(text, 'clientWidth', { configurable: true, value: 200 });
    resizeObserver.trigger(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');
  } finally {
    resizeObserver.restore();
  }
});
```

To prove that a bar observes nothing (`'auto'` without actions, an explicit layout), spy on `ResizeObserver.prototype.observe` after `installResizeObserverMock()` and expect no call; without the mock nothing observes anyway, and the assertion would prove nothing.

### Pointer drags: the color parts

jsdom has no pointer capture. Stub it in a `beforeEach`, give the field a box, and dispatch pointer events with their `pointerType`:

```tsx
// src/components/input/__tests__/ColorArea.test.tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ColorArea } from '../ColorArea';
import { colorAreaClassNames } from '../../../lib/classNames';
import { mockRect } from '../../../test-utils';

beforeEach(() => {
  const captured = new WeakSet<Element>();
  Element.prototype.setPointerCapture = vi.fn(function (this: Element) {
    captured.add(this);
  });
  Element.prototype.releasePointerCapture = vi.fn(function (this: Element) {
    captured.delete(this);
  });
  Element.prototype.hasPointerCapture = vi.fn(function (this: Element) {
    return captured.has(this);
  });
});

it('jumps to a touch press', () => {
  const onValueChange = vi.fn();
  render(<ColorArea aria-label="Color" defaultValue={{ h: 0, s: 0, v: 0 }} onValueChange={onValueChange} />);
  const area = screen.getByRole('group', { name: 'Color' });
  mockRect(area.querySelector(`.${colorAreaClassNames.field}`) as HTMLElement, {
    x: 0,
    y: 0,
    width: 200,
    height: 100,
  });
  act(() => {
    fireEvent.pointerDown(area, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 150, clientY: 25 });
  });
  expect(onValueChange).toHaveBeenLastCalledWith({ h: 0, s: 0.75, v: 0.75 });
});
```

Test RTL with `renderWithProviders(ui, { dir: 'rtl' })` (the x axis mirrors), and the pointer type with `mockMatchMedia({ '(pointer: coarse)': true })`: on a coarse pointer both inputs stay exposed (without it the mock matches nothing, which is the desktop model the server renders).

### Pure models: the tree cascade

`Tree.selection.ts` holds the cascade as pure functions (`collectItems`, `computeCheckStates`, `toggleCheck`). Test them without rendering: build the item tree from JSX children, then assert the state map and the emitted arrays (tree order, fully checked parents included, unmatched values kept at the end). Render only for what the model cannot show: the attributes, the keys and the callback.
````

The ColorArea recipe's `pointerDown` target, the expected `s`/`v` values and the field class are written from the spec (D19); check them in Step 10 against the final test file `src/components/input/__tests__/ColorArea.test.tsx` and copy its real pattern if it differs.

- [ ] **Step 10: Confirm the names against the code**

```bash
grep -n "export function withPartClass" src/components/button/Button.slots.tsx
grep -n "'class-names'" src/__tests__/conventions.test.ts
grep -n "export function getStableClassNames\|DISPLAY_NAME_ALIASES\|VARIANT_BASES" src/test-utils.ts
grep -n "NO_ELEMENT\|PENDING_CLASS_NAMES" src/__tests__/classNames.test.ts
grep -n "PENDING_PUBLIC_TYPES" src/__tests__/public-types.test.ts
grep -n "animated" src/test-utils.ts
grep -n "export function collectItems\|export function computeCheckStates\|export function toggleCheck" src/components/layout/Tree.selection.ts
grep -n "setPointerCapture\|pointerType" src/components/input/__tests__/ColorArea.test.tsx | head -5
grep -n "installResizeObserverMock\|scrollWidth" src/components/feedback/__tests__/MessageBar.reflow.test.tsx | head -5
grep -n "data-wave-toast" src/components/feedback/__tests__/Toast.parts.test.tsx | head -3
```

Expected: every grep prints a line. Where a helper, function or test pattern differs, change the guide text to match.

- [ ] **Step 11: Check the links and commit**

```bash
node node_modules/.cache/wave-docs/doclinks.cjs docs/WAVE-UI-GUIDE.md docs/testing-best-practices.md
git status --short
git add docs/WAVE-UI-GUIDE.md docs/testing-best-practices.md
git commit -m "docs(guide): stable class names, Phase 3 accessibility patterns and test recipes"
```

Expected: `0 problems`; only the two guides are listed before `git add`.

---

### Task D5: ROADMAP

**Files:**
- Modify: `docs/ROADMAP.md` (status and header bullets; §4 table; the Phase 3 section; P11-04, P13-01, P13-02, P13-03, P14-02; §8.1, §8.3, §8.5)

**Interfaces:**
- Consumes: the spec's rulings (D2 … D33) and §7 gap table.
- Produces: the roadmap state that the release commit marks "released".

- [ ] **Step 1: Status and design link**

In the **Status** bullet, after `Phase 2's design spec is [\`docs/superpowers/specs/2026-09-26-fluent-parity-phase-2-design.md\`](superpowers/specs/2026-09-26-fluent-parity-phase-2-design.md).` insert:

```markdown
 **Phase 3 (0.8.0) is implemented, unreleased**, on `feat/fluent-parity-phase-3`; its design spec, [`docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md`](superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md), records where it changed the Phase 3 sketches below.
```

After the `- **Phase 2 design:**` bullet, add:

```markdown
- **Phase 3 design:** [`docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md`](superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md) (0.8.0, implemented; unreleased).
```

- [ ] **Step 2: Release overview**

In the §4 table, replace the Phase 3 row's last cell `4 / 6 / 11` with `4 / 6 / 10`, and the Phase 13 row's `0 / 1 / 12` with `0 / 1 / 13` (`buttons-29` moves from P3-00 to P13-02; the totals row does not change).

- [ ] **Step 3: Phase 3 section**

After the line that starts `**Entry:** 0.7.0 merged to \`main\`` (in "Phase 3 — 0.8.0"), add a paragraph:

```markdown
**What the Phase 3 spec changed** ([design](superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md); each ruling gives its reason): the class-name constants live in one server-safe registry, `src/lib/classNames.ts`, exported from the entry, not in the component modules (D2); P3-00 mitigates `buttons-29` and P13-02 closes it (D8); the dismissing part is `Toast.Close`, not `Toast.Trigger`, and the status icon is replaced through `icon` on the Toast root, with no `media` slot on `Toast.Title` (D9); a toast whose content holds an action stays until it is dismissed unless the dispatch passes a `timeout` (D12); a MessageBar's title names the bar only when the bar has a non-live role (D16); `layout="auto"` measures the text column, and no layout clips text (D17); `ColorArea`, `ColorSlider` and `AlphaSlider` bind to an enclosing ColorPicker, which gains `ColorPicker.Preview` and no `Area`, `HueSlider` or `AlphaSlider` members (D21); a checkbox tree's checkbox is an exposed `role="checkbox"`, not a decorative indicator (D25); `navigationMode` changes the keyboard only (D27); the persona layout is `Tree.ItemPersonaLayout`, Fluent's name (D28); dispatches through an unbound toaster handle wait in its queue (D33). P3-00's acceptance "`verify-dist` flat names include the constants" is met by verify-dist's check that the entry exports every constant with the same value.
```

In P3-00, replace `  - **Closes:** \`foundation-37\` (M), \`buttons-29\` (L).` with:

```markdown
  - **Closes:** `foundation-37` (M). **Mitigates:** `buttons-29` (L), closed by P13-02 (static class names are half of that gap; the public contexts are the other half).
```

- [ ] **Step 4: Later items**

In P11-04, append to the end of its **API sketch** bullet: ` The flat model also revisits real \`treegrid\` roles for Tree's \`navigationMode="treegrid"\`, which keeps \`tree\` and \`treeitem\` in 0.8 (Phase 3 spec, D27).`

In P13-01, append to the end of its **API sketch** bullet: ` The part keys of the class-name registry (Phase 3 spec, Appendix A) are the \`slotProps\` keys.`

In P13-02, replace `, \`ctx-1\` (L).` (the end of its **Closes** line) with `, \`ctx-1\` (L), \`buttons-29\` (L; P3-00 shipped the static class names, this item the public contexts and recomposition hooks).`

In P13-03, replace `the \`details\` parameter of every \`onOpenChange\` and of \`onCheckedValuesChange\` (Menu, Toolbar; 0.7) becomes required (P14-02)` with `the \`details\` parameter of every \`onOpenChange\`, of \`onCheckedValuesChange\` (Menu, Toolbar; 0.7) and of \`onCheckedItemsChange\` (Tree; 0.8) becomes required (P14-02)`.

In P14-02, replace `and so does the \`details\` parameter of \`onCheckedValuesChange\` (Menu, Toolbar; announced in the 0.7 CHANGELOG).` with `and so do the \`details\` parameters of \`onCheckedValuesChange\` (Menu, Toolbar; announced in the 0.7 CHANGELOG) and \`onCheckedItemsChange\` (Tree; announced in the 0.8 CHANGELOG).`

- [ ] **Step 5: Backlog sections**

In §8.1, replace `- Two gaps are mitigated early without being closed: \`taggroup-1\` by P1-15 (closed by P6-02) and \`badge-1\` by P1-13 (closed by P14-05).` with:

```markdown
- Three gaps are mitigated early without being closed: `taggroup-1` by P1-15 (closed by P6-02), `badge-1` by P1-13 (closed by P14-05) and `buttons-29` by P3-00 (closed by P13-02).
```

In §8.3, append after the Phase 2 list (after the bullet that starts `- No global positioning configuration`):

```markdown

Behaviour differences decided by a phase spec (Phase 3, 0.8.0), with no gap of their own:

- A toast's severity (its politeness and spoken prefix) comes from the rendered `Toast`; Fluent reads it from the dispatch options only.
- Every toast in a Toaster shows the Dismiss button, rich ones included; the opt-out stays in the backlog (`toaster-9`).
- A toast that holds an action stays until it is dismissed unless the dispatch passes a `timeout`; Fluent times out every toast.
- Every toast pauses while the pointer or focus is anywhere in the toast region; Fluent pauses the toasts of a position while one has focus, and on hover or window blur only with `pauseOnHover` and `pauseOnWindowBlur`.
- Backspace also dismisses a focused toast (the delete key of Mac keyboards), next to Fluent's Delete.
- A MessageBar's title does not name a bar that is a live region (its default roles); it is read as the start of its content. With a non-live role (`region`, `group`) it names the bar, as Fluent's always does.
- One DOM order (icon, text, actions, Dismiss) serves both MessageBar layouts, where Fluent reorders the DOM; no layout clips the text, where Fluent's single line does not wrap.
- ColorArea mirrors its x axis in right-to-left layouts; Fluent's does not.
- Checks in a multi-select Tree cascade; Fluent's nested Tree keeps them independent (its flat-tree helper computes the cascade).
- `navigationMode="treegrid"` changes the keyboard only and keeps the `tree` and `treeitem` roles, as Fluent's does.
```

In §8.5, append four bullets at the end of the list:

```markdown
- **Arrow keys between toasts.** 0.8 moves between toasts with Tab only; Fluent's arrow navigation is marked as a stopgap in its own source. Fix: Up and Down between the toast containers of a Toaster, once a pattern that screen readers support is found. **Size:** S.
- **Tree checks that do not cascade.** A 0.8 checkbox tree always cascades (the Phase 3 ruling, D24), so a tree whose parents are independent items cannot be built. Fix: an option for independent checks, named in its phase spec. **Size:** S.
- **Range selection in a multi-select Tree.** Shift+Arrow, Shift+Space and Ctrl+A (optional in the APG treeview pattern) are not implemented. **Size:** M.
- **Real `treegrid` roles.** `navigationMode="treegrid"` keeps `tree` and `treeitem`, because treegrid rows need one flat list with `aria-level`. Fix: with the flat tree model of P11-04. **Size:** M.
```

- [ ] **Step 6: Verify the tallies and links**

```bash
grep -n "buttons-29" docs/ROADMAP.md
grep -n "^| 3 | 0.8.0\|^| 13 | 0.18.0" docs/ROADMAP.md
node node_modules/.cache/wave-docs/doclinks.cjs docs/ROADMAP.md
```

Expected: `buttons-29` appears in P3-00's **Mitigates**, the Phase 3 changes paragraph, P13-02's **Closes** and §8.1 (four places, none as a P3-00 **Closes**); the two rows end in `4 / 6 / 10 |` and `0 / 1 / 13 |`; `0 problems`.

- [ ] **Step 7: Commit**

```bash
git status --short
git add docs/ROADMAP.md
git commit -m "docs(roadmap): Phase 3 implemented; spec changes, buttons-29 to P13-02, follow-ups"
```

- [ ] **Step 8: At the release (the lead, in the release commit; not now)**

When 0.8.0 is tagged, the release commit replaces `**Phase 3 (0.8.0) is implemented, unreleased**, on \`feat/fluent-parity-phase-3\`;` with `**Phase 3 (0.8.0) is released** (CHANGELOG \`## [0.8.0] - YYYY-MM-DD\`);` and `(0.8.0, implemented; unreleased)` with `(0.8.0, released YYYY-MM-DD)`, with the release date (spec §6.5). This step is listed in the index's wave E and is not part of this task's commit.

---

### Task D6: Fluent comparison guide

**Files:**
- Modify: `docs/FLUENT-UI-COMPARISON.md` (the guide is revised for 0.8.0: its §9 asks to update it with each minor release, and every Phase 3 gap moves from §7 "Not in WaveUI yet" into the comparison)

**Interfaces:**
- Consumes: README anchors from Task D2 (`#styling-hooks`, `#toasts`, `#message-bars`, `#color`, `#trees`); `dist/` from `npm run build`; the published 0.7.0 package.
- Produces: nothing other tasks use.

- [ ] **Step 1: Save the tools and reproduce the 0.7 column**

Save `doclinks.cjs` and `measure-compare.mjs`, get the published 0.7.0 package (see "Shared verification tools"), and run:

```bash
node node_modules/.cache/wave-docs/measure-compare.mjs node_modules/.cache/wave-docs/v070/package/dist
```

Expected: `| Button | 39.0 KiB (12.3 KiB gzip) |` … `| Everything | 427.4 KiB (141.2 KiB gzip) |`, exactly the guide's WaveUI 0.7 column. If it differs, stop: the method no longer matches §9 (check the esbuild version, `node -e "console.log(require('esbuild/package.json').version)"`, which §9 says is 0.28.2), and ask the lead.

- [ ] **Step 2: Measure 0.8.0**

```bash
npm run build
node node_modules/.cache/wave-docs/measure-compare.mjs dist
```

Keep the output: Steps 4, 7 and 8 fill the `«…»` cells from it.

- [ ] **Step 3: The header**

Replace the **Compared** bullet with:

```markdown
- **Compared:** WaveUI 0.8.0 (`@mortenbrudvik/waveui`; this revision was written for its release) and Fluent UI React v9 (`@fluentui/react-components` 9.74.9, released 2026-09-23, the latest release on 2026-09-26). 0.8.0 adds toasts with React content, MessageBar parts, ColorArea and the color sliders, Tree multi-select and row actions, and stable class names to 0.7.0 (released 2026-09-26).
```

In the **Related documents** bullet, replace `WaveUI 0.6 and 0.7 closed 77 of them, including three of the seven rated high impact (submenus, checkbox and radio menu items); the other four (toasts with rich content, a color area, a hue slider, Tree multi-select) are planned for 0.8.` with:

```markdown
WaveUI 0.6, 0.7 and 0.8 closed 97 of them, including all seven rated high impact (submenus and checkbox and radio menu items in 0.7; toasts with rich content, a color area, a hue slider and Tree multi-select in 0.8).
```

Then replace every remaining `WaveUI 0.7` with `WaveUI 0.8` (the table headers of §1, §3.1, §3.7, §3.9, §3.10, §3.11, §3.12, §4.1, §4.2, §4.6, §5.1–§5.9 and §7, the §3.6 paragraph, the §5.9 code comment and the §8.3 sentence), except `WaveUI 0.7.0` in §9's **Versions** bullet, which Step 9 rewrites:

```bash
grep -n "WaveUI 0\.7" docs/FLUENT-UI-COMPARISON.md
```

Edit each hit the grep lists. Expected afterwards: only the §9 **Versions** line (`WaveUI 0.7.0 (the repository at \`bcbdb51\`, …`) is listed.

- [ ] **Step 4: §1 At a glance and §2 Which one to choose**

In the §1 table, replace the WaveUI cells of four rows:

```markdown
| Customization | a slot for every part, static class names, app-wide style hooks, recomposition hooks | `className`, `data-*` state attributes, a stable class name on every component and part (`wave-button__icon`, exported as `buttonClassNames`), slots for icons and content |
| Components | about 60 stable ones; charts in a separate package, the date and time pickers in compat packages | 68, including Pagination, Stepper and layout primitives |
| Motion | built into overlays and disclosures | a presence primitive that menus and toasts mount through; motion on components is planned for 0.15 |
| Whole library, minified and gzipped | 326 KiB of JavaScript | «Everything gzip, rounded» KiB of JavaScript and «styles.css gzip, rounded» KiB of CSS |
```

(round to whole KiB, as 0.7 wrote 141 and 10). In §2, in the bullet **You need something WaveUI does not have yet:**, delete `Tree multi-select, a color area and hue slider, toasts with actions, `. Replace the bullet **You want to rebuild components from their parts.** with:

```markdown
- **You want to rebuild components from their parts.** Fluent exposes a slot on every part, app-wide style hooks, each component's state and render hooks (`use*_unstable`, `render*_unstable`) and its focus-management hooks. WaveUI has a stable class name on every part (0.8) and plans slots for structural parts and public contexts for 0.18.
```

In the bullet **Size matters.**, recompute the two ratios with the new numbers (the form controls row plus the stylesheet, gzip, against Fluent's 64.4 KiB; the whole library plus the stylesheet against Fluent's 325.6 KiB): keep "about a quarter less" while the form controls stay 20–30% below Fluent, and "less than half" while the whole library stays below half; otherwise state the percentages.

- [ ] **Step 5: §3 How the two libraries differ**

In the §3.1 table, replace the row that starts `| Selecting a part from CSS or a test |` with:

```markdown
| Selecting a part from CSS or a test | a static class name on every part (`.fui-Button`, `.fui-Button__icon`, exported as `buttonClassNames`) | a stable class name on every component and part (`.wave-button`, `.wave-button__icon`, exported as `buttonClassNames`); no state classes (use the `data-*` attributes); for tests, roles, accessible names and `data-*` attributes |
```

Add a bullet at the end of "Things that catch Fluent developers" (after the `makeStyles` bullet):

```markdown
- **Class names follow Fluent's scheme**, spelled `wave-button` and `wave-button__icon` (Fluent: `fui-Button`, `fui-Button__icon`). A variant also carries its base's classes (a ToggleButton is `wave-button wave-toggle-button`), and state is never a class ([README: Styling hooks](../README.md#styling-hooks)).
```

In §3.4, append to the bullet **Compound parts in Server Components.**: ` The class-name constants and \`createToaster\` come from server-safe modules, so a Server Component can import them.`

In §3.6, replace `Only \`Menu.Popover\` mounts through it, and it animates only with classes you add.` with `\`Menu.Popover\` and the toasts in a Toaster mount through it, and they animate only with classes you add (a toast's container carries \`wave-toaster__toast\`).`

In §3.8, replace `exports one hook from it, \`useRovingTabIndex\` (arrow keys along one axis, typeahead, right-to-left).` with `exports one hook from it, \`useRovingTabIndex\` (arrow keys along one axis, typeahead, right-to-left, and \`tabStop: 'none'\` for a composite reached by arrow keys only).`

Add four rows at the end of the §3.9 table:

```markdown
| Arrow keys between toasts | move between the toasts of a Toaster | not supported: Tab and Shift+Tab move through the toasts' controls | a gap (a roadmap follow-up) |
| Dismissing a focused toast | Delete | Delete or Backspace (the delete key of Mac keyboards) | deliberate |
| Checking a parent in a multi-select Tree | checks that item only (the nested Tree leaves the cascade to you) | checks the item and all its descendants; a parent shows mixed | deliberate |
| Left and Right in a ColorArea, right to left | not mirrored | mirrored (saturation grows toward the end) | deliberate |
```

In the §3.10 table's first row, replace `(DatePicker as \`yyyy-mm-dd\`, TimePicker as \`HH:mm\`, a multi-value picker as one entry per value)` with `(DatePicker as \`yyyy-mm-dd\`, TimePicker as \`HH:mm\`, ColorArea, ColorSlider and AlphaSlider as hex, a multi-value picker as one entry per value)`.

In §3.12, add a row after `| \`useAnnounce\` | \`useAnnounce\`, \`announce\` | no provider needed |`:

```markdown
| `useToastController(toasterId)` in any component | `useToastController()` inside a `<Toaster>`, or a handle from `createToaster()` bound with `<Toaster toaster={handle}>`, callable from any code | one handle per Toaster replaces `toasterId` |
```

- [ ] **Step 6: §3.11 sizes**

Replace the WaveUI column of the §3.11 table with the Step 2 output:

```markdown
| What the app imports | Fluent UI v9, JavaScript | WaveUI 0.8, JavaScript |
|---|---|---|
| Button | 61.7 KiB (12.1 KiB gzip) | «Button» |
| Button and the provider | 96.3 KiB (23.2 KiB gzip) | «Button and the provider» |
| Button, Field, Input, Checkbox, Switch, Dropdown | 239.3 KiB (64.4 KiB gzip) | «Button, Field, Input, Checkbox, Switch, Dropdown» |
| Dialog, Menu, Popover, Tooltip | 210.6 KiB (65.2 KiB gzip) | «Dialog, Menu, Popover, Tooltip» |
| DataGrid, Table | 151.8 KiB (45.5 KiB gzip) | «DataGrid, Table» |
| Everything | 1,279.0 KiB (325.6 KiB gzip) | «Everything» |
```

Then update the bullets under it with these computations (gzip, KiB, one decimal): **CSS.** `dist/styles.css` from the first output line. **With the stylesheet counted**: each WaveUI row's gzip plus the stylesheet's gzip, for the Button-and-provider, overlays, form, tables and whole-library comparisons (keep "about the same" for a pair within 10% of each other, "less" otherwise). **Providers.** WaveProvider = (Button and the provider) − (Button), minified and gzip. **Install**: run `npm pack --dry-run --json` and write its `unpackedSize` (MB, one decimal) and the sum of the sizes of its `.map` files as the source-map share. Leave the Fluent numbers and "Where the bytes go" as they are, unless the tailwind-merge share of the Button bundle changed by more than 1 KiB (then measure it with esbuild's `metafile` and update the number).

- [ ] **Step 7: §4 Translating Fluent code**

In §4.1, replace the ColorPicker row and add two rows:

```markdown
| ColorPicker `onColorChange(ev, { color })`, an HSV object | `onValueChange(hex)`, a hex string |
| ColorArea, ColorSlider, AlphaSlider `onChange(ev, { color })` | `onValueChange(color)`, an `HsvColor` (the same `{ h, s, v, a? }`) |
```

and after the row `| Tree \`onOpenChange(ev, { open, openItems, value })\` | \`onExpandedItemsChange(items)\` |`:

```markdown
| Tree `onCheckedChange(ev, { value, checked, checkedItems })` | `onCheckedItemsChange(checkedItems, { value, checked, event })`, a string array (checks cascade) |
```

In the paragraph under the close-reasons example, replace `(Dialog, Drawer, Menu and Toolbar checked values)` with `(Dialog, Drawer, Menu and Toolbar checked values, Tree checked items)`.

In §4.2, add four rows at the end of the table:

```markdown
| `ToastTrigger` | `Toast.Close` / `ToastClose` (it dismisses the toast) |
| `ToastTitle` `media` | `icon` on `Toast` |
| `MessageBarBody` | none: the bar's children are its body |
| `TreeItemLayout` | none: the item's children are its label, with `icon`, `iconAfter`, `aside` and `actions` on `Tree.Item` |
```

and replace the recurring-renames sentence with:

```markdown
Recurring prop renames: `vertical` becomes `orientation="vertical"` (TabList, Toolbar, Divider, ColorSlider, AlphaSlider), `intent` becomes `status` (MessageBar, Toast), `selectedValue` becomes `value`, `selectionMode="multiselect"` becomes `"multiple"` (List, DataGrid, Tree), a color part's `color` becomes `value`, `circular` (Carousel) becomes `loop`, `toasterId` becomes a handle from `createToaster()` passed to `<Toaster toaster>`, and `Portal`'s `mountNode` becomes `container` (a surface's `mountNode` becomes `portalContainer` on a nested `WaveProvider`).
```

In §4.4, first bullet, replace `(\`icon\`, \`contentBefore\`, \`contentAfter\`, \`dismiss\`, \`dismissIcon\`, \`expandIcon\`, \`menuIcon\`, \`checkmark\`, \`validationMessageIcon\`)` with `(\`icon\`, \`iconAfter\`, \`action\`, \`contentBefore\`, \`contentAfter\`, \`dismiss\`, \`dismissIcon\`, \`expandIcon\`, \`menuIcon\`, \`checkmark\`, \`validationMessageIcon\`)`; second bullet, replace `(MenuButton's \`menuIcon\`, the \`expandIcon\` of Combobox and TimePicker)` with `(MenuButton's \`menuIcon\`, the \`expandIcon\` of Combobox, TimePicker and \`Tree.Item\`)` and `(MessageBar's \`icon\`, Field's \`validationMessageIcon\`)` with `(MessageBar's and Toast's \`icon\`, Field's \`validationMessageIcon\`)`.

In §4.6, replace the two Toast rows and add two rows after the Toast rows:

```markdown
| Toast | `timeout` | 3000ms | 5000ms; a toast with an action stays until it is dismissed unless you pass `timeout` |
| Toast | pausing | off (`pauseOnHover`, `pauseOnWindowBlur`) | always: every toast while the pointer or focus is anywhere in the toast region, and while the window is in the background |
| Toast | severity | the dispatch options (`intent`) | the rendered Toast's `status` (the options' `status` for other content) |
| Tree (multi-select) | checking a parent | checks the item only | checks it and its descendants; the parent shows mixed |
```

In the **Names, roles and elements** bullet after the table, replace `MessageBar and Toast say their severity;` with `MessageBar and Toast say their severity, and a toast in a Toaster is a \`role="group"\` named by its severity and title;`.

- [ ] **Step 8: §5 Component map**

In §5.3, replace the ColorPicker row and its bullet:

```markdown
| `ColorPicker`, `ColorArea`, `ColorSlider`, `AlphaSlider` | `ColorPicker` (with `ColorPicker.HexField`, `.Swatches`, `.Preview`), `ColorArea`, `ColorSlider`, `AlphaSlider` | |
```

```markdown
- **ColorPicker.** Fluent's value is an HSV object (`color: { h, s, v, a }`). WaveUI's ColorPicker keeps a hex string (`value` and `onValueChange(hex)`: `#rrggbb`, or `#rrggbbaa` below full opacity), while `ColorArea`, `ColorSlider` and `AlphaSlider` take Fluent's `HsvColor` (`value` and `onValueChange(color)` for Fluent's `color` and `onChange`). Compose them as in Fluent: inside a ColorPicker, a part without `value` and `defaultValue` binds to the picker (`<ColorPicker><ColorArea /><ColorSlider /><AlphaSlider /></ColorPicker>`), and `ColorPicker.HexField`, `ColorPicker.Swatches` and `ColorPicker.Preview` add the hex field, the presets and a preview. Without children the picker renders an area, a hue slider, the hex field, the presets and, with `showOpacity`, an alpha slider. ColorSlider's `vertical` becomes `orientation="vertical"`; `hsvToHex` and `hexToHsv` convert at the boundary. The area mirrors in right-to-left layouts, and its value texts name the color ([README: Color](../README.md#color)).
```

In §5.5, replace the MessageBar and Toast rows and their two bullets:

```markdown
| `MessageBar`, `MessageBarBody`, `MessageBarTitle`, `MessageBarActions` | `MessageBar`, `MessageBar.Title`, `MessageBar.Actions` (the body is the bar's children) | `shape`, politeness (backlog) |
| `Toaster`, `useToastController`, `Toast`, `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastTrigger` | `Toaster`, `useToastController`, `createToaster`, `Toast`, `Toast.Title`, `Toast.Body`, `Toast.Footer`, `Toast.Close` | the inverted appearance, offsets, centered positions, priority (backlog); motion (0.15) |
```

```markdown
- **MessageBar.** `intent` becomes `status` (the same four values, `info` by default). `MessageBarTitle` becomes `MessageBar.Title` and `MessageBarActions` `MessageBar.Actions`, as direct children; the rest of the children is the body (there is no `MessageBarBody`). `layout` (`auto`, the default, `singleline`, `multiline`) reflows the actions as in Fluent, with one DOM order for both layouts and no clipped text. With its default roles the bar is a live region whose title is read as the start of its content; give a notice that stays on the page `role="region"`, and the title names it. `onDismiss` adds a dismiss button, after the actions ([README: Message bars](../README.md#message-bars)).
```

```markdown
- **Toasts.** `dispatchToast(<Toast><ToastTitle>…</ToastTitle></Toast>, { intent: 'success', timeout })` becomes `dispatchToast(<Toast status="success"><Toast.Title>…</Toast.Title></Toast>, { timeout })`: the severity is the rendered Toast's `status` (for other content, the options' `status`), and the call returns the toast's id. `ToastTitle`, `ToastBody` and `ToastFooter` become `Toast.Title` (with `action`), `Toast.Body` (with `subtitle`) and `Toast.Footer`; `ToastTrigger` becomes `Toast.Close`, and `ToastTitle`'s `media` the Toast's `icon`. The text form (`dispatchToast({ status, title, body })`) still works. `useToastController()` works under a `<Toaster>` ancestor; instead of `toasterId`, `createToaster()` returns a handle that `<Toaster toaster={handle}>` binds and any code can call. A toast with an action stays until it is dismissed unless you pass `timeout`. `shortcuts.focus` keeps Fluent's shape; Escape dismisses every toast and Delete or Backspace the focused one. The `Toast` component renders one toast in place, as its own live region. `position` takes the four logical corners (`bottom-end`, …) and the four physical ones (`top-left`, …), but not Fluent's centered `top` and `bottom`; the default is `bottom-end` in both. For the timing and dismiss defaults, see [4.6](#46-defaults-that-differ), and [README: Toasts](../README.md#toasts).
```

In §5.6, replace the Tree row and its bullet:

```markdown
| `Tree`, `TreeItem`, `TreeItemLayout`, `TreeItemPersonaLayout` | `Tree`, `Tree.Item`, `Tree.ItemPersonaLayout` | `appearance`, `size` (backlog); motion (0.15) |
```

```markdown
- **Tree.** `openItems` and `onOpenChange(ev, data)` become `expandedItems` and `onExpandedItemsChange(items)`. An item's text is its children, next to its nested `Tree.Item`s (there is no `TreeItemLayout`: `icon`, `iconAfter`, `aside`, `actions` and `expandIcon` are props of `Tree.Item`); an item with nested items is a branch (Fluent's `itemType`), and `leaf` forces a leaf. Items cannot be disabled. `selectionMode="multiselect"` becomes `"multiple"`, with `checkedItems` and `onCheckedItemsChange(checkedItems, details)`, and checks cascade (checking a parent checks its descendants, which Fluent's nested Tree leaves to you); `'single'` draws radios for `selected` and `onItemSelect(value)`. `navigationMode="treegrid"` keeps its name and moves the arrows into a row's actions. `TreeItemPersonaLayout` is `Tree.ItemPersonaLayout` ([README: Trees](../README.md#trees)).
```

- [ ] **Step 9: §6, §7, §8 and §9**

In §6 "Behavior built into WaveUI", replace the **Toasts** bullet with:

```markdown
- **Toasts** pause while the pointer or focus is anywhere in the toast region, on window blur and in a hidden tab (in Fluent, pausing is opt-in), a toast with an action waits for the user, and toasts stay reachable by Tab over an open Dialog and move out of the way of an open Drawer. MessageBar and Toast say their severity ("Warning"), and the text can be translated.
```

and add after it:

```markdown
- **Tree checks cascade** in the nested Tree, and a parent shows mixed; Fluent computes the cascade only with its flat-tree helper.
```

In §7, delete the five rows whose "Planned" cell is `0.8` (toasts with React content; `MessageBarTitle`; `ColorArea`; Tree multi-select; static class names), and in the intro replace `0.6 and 0.7 were the first two phases of the roadmap.` with `0.6, 0.7 and 0.8 were the first three phases of the roadmap.`

In §8.3, replace the WaveUI example's import line and `save` line:

```tsx
import { Button, Dialog, Dropdown, Field, Input, Stack, Toast, useToastController } from '@mortenbrudvik/waveui';
```

```tsx
  const save = () =>
    dispatchToast(
      <Toast status="success">
        <Toast.Title>Project renamed</Toast.Title>
      </Toast>,
    );
```

and in the sentence above it, replace `and \`Dialog.Close\` replaces the close triggers:` with `\`Dialog.Close\` replaces the close triggers, and the toast keeps its parts (\`Toast.Title\`) with the severity on the Toast:`.

In §8.4, replace the **Class selectors** bullet with:

```markdown
- **Class selectors.** Fluent's `.fui-*` classes map to WaveUI's stable classes (`.fui-MenuItem` → `.wave-menu-item`, `.fui-Button__icon` → `.wave-button__icon`); still, query by role (`getByRole('menuitem', { name: 'Edit' })`) or by `data-*` attribute (`[data-checked]`, `[data-state=open]`) where you can.
```

In §9, replace `- **Versions:** WaveUI 0.7.0 (the repository at \`bcbdb51\`, identical to the npm package) and` with `- **Versions:** WaveUI 0.8.0 (the \`feat/fluent-parity-phase-3\` branch as merged for the release; the sizes of 3.11 from its \`npm run build\` output) and`. At the release (wave E) the lead replaces `(the \`feat/fluent-parity-phase-3\` branch as merged for the release; …)` with `(the repository at the \`v0.8.0\` tag, identical to the npm package)` and, in the Compared bullet, `this revision was written for its release` with `released YYYY-MM-DD`.

- [ ] **Step 10: Confirm the names against the code, then verify**

```bash
grep -n "export function createToaster" src/lib/toaster.ts
grep -n "export function hsvToHex\|export function hexToHsv" src/lib/color.ts
grep -n "navigationMode?:\|selectionMode?:" src/components/layout/Tree.core.tsx
grep -n "shortcuts?:\|toaster?:" src/components/feedback/Toaster.tsx
grep -n "layout?:" src/components/feedback/MessageBar.tsx
grep -c "«" docs/FLUENT-UI-COMPARISON.md
grep -n "(0\.8)\|| 0\.8 |" docs/FLUENT-UI-COMPARISON.md
grep -n "WaveUI 0\.7" docs/FLUENT-UI-COMPARISON.md
node node_modules/.cache/wave-docs/doclinks.cjs docs/FLUENT-UI-COMPARISON.md
```

Expected: the five API greps print lines; `0` placeholders; no "(0.8)" planned entry and no §7 row planned for 0.8 remains; the `WaveUI 0.7` grep prints nothing (the Compared bullet says `0.7.0 (released 2026-09-26)` without "WaveUI" in front); `0 problems` (the README anchors of Task D2 exist).

- [ ] **Step 11: Commit**

```bash
git status --short
git add docs/FLUENT-UI-COMPARISON.md
git commit -m "docs(comparison): revise the Fluent comparison for 0.8.0"
```

Expected: only `docs/FLUENT-UI-COMPARISON.md` is listed before `git add`. Report D6 as a plan addition to the spec (a §10 note).
