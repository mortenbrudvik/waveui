#!/usr/bin/env node
/**
 * The skipped-stories gate of the built site (`npm run site:check`): the stories the build could
 * not render must be named, with a reason, in `website/skipped-stories.json`, and the list must
 * name nothing else.
 *
 * What the build knows: every component page writes `website/.cache/story-report/<slug>.json`
 * (`src/examples/storyReport.ts`), the result of the server render of each story of its entry,
 * the listed ones included. This script fails when:
 *
 * - a story did not render and is not listed (the example shows an error panel instead);
 * - a listed story is no longer a story of the catalog, or renders now (a stale entry);
 * - an entry has no reason, names no story, or is listed twice;
 * - the report does not cover exactly the pages of `dist` (a report left over from an older
 *   catalog, or a page built without one).
 *
 * `src/stories/runtime.test.tsx` asserts the same set equality over the runtime; this is the
 * check of the build's own result.
 *
 * Usage: node scripts/check-skipped.mjs [--report-dir <dir>] [--dist <dir>] [--skipped <file>]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REBUILD = 'run npm run site:build first';

/**
 * The problems between the reports and the list.
 *
 * @param {{ reports: { slug: string, stories: { story: string, rendered: boolean, error?: string }[] }[],
 *   skipped: unknown, pageSlugs?: string[] }} input `pageSlugs`, when given, are the component
 *   pages of the build, which the reports must cover exactly.
 * @returns {string[]}
 */
export function checkSkipped({ reports, skipped, pageSlugs }) {
  const problems = [];

  if (pageSlugs) {
    const reported = new Set(reports.map((item) => item.slug));
    for (const slug of pageSlugs) {
      if (!reported.has(slug)) {
        problems.push(`the build wrote no story report for the page ${slug}; ${REBUILD}`);
      }
    }
    for (const slug of reported) {
      if (!pageSlugs.includes(slug)) {
        problems.push(`the story report of ${slug} belongs to no page of the build; ${REBUILD}`);
      }
    }
  }

  const list = [];
  if (!Array.isArray(skipped)) {
    problems.push('skipped-stories.json must be an array of { story, reason }');
  } else {
    const seen = new Set();
    for (const item of skipped) {
      const story = typeof item?.story === 'string' ? item.story : undefined;
      if (!story) {
        problems.push('skipped-stories.json: an entry names no story');
        continue;
      }
      if (seen.has(story)) problems.push(`skipped-stories.json: ${story} is listed twice`);
      seen.add(story);
      if (typeof item.reason !== 'string' || item.reason.trim() === '') {
        problems.push(`skipped-stories.json: ${story} has no reason`);
      }
      list.push(story);
    }
  }

  const stories = new Map(
    reports.flatMap((item) => item.stories.map((entry) => [entry.story, entry])),
  );
  for (const [id, entry] of stories) {
    if (!entry.rendered && !list.includes(id)) {
      problems.push(
        `${id} could not be rendered by the site (${entry.error ?? 'no message'}) and is not listed in skipped-stories.json: fix the story, or list it with a reason`,
      );
    }
  }
  for (const id of new Set(list)) {
    const entry = stories.get(id);
    if (!entry) {
      problems.push(
        `skipped-stories.json: ${id} is not a story of the catalog any more: remove it`,
      );
    } else if (entry.rendered) {
      problems.push(`skipped-stories.json: ${id} renders now: remove it`);
    }
  }
  return problems;
}

/**
 * Reads the files and checks them. Throws an `Error` whose message says to build first when the
 * build wrote no report.
 */
export function runCheckSkipped({ reportDir, dist, skippedFile }) {
  const files = existsSync(reportDir)
    ? readdirSync(reportDir).filter((name) => name.endsWith('.json'))
    : [];
  if (files.length === 0) throw new Error(`${reportDir} holds no story report; ${REBUILD}`);
  const reports = files.map((name) => JSON.parse(readFileSync(join(reportDir, name), 'utf8')));
  const components = join(dist, 'components');
  const pageSlugs = existsSync(components)
    ? readdirSync(components)
        .filter((name) => name.endsWith('.html'))
        .map((name) => name.slice(0, -'.html'.length))
    : [];
  let skipped;
  try {
    skipped = JSON.parse(readFileSync(skippedFile, 'utf8'));
  } catch (error) {
    return [`skipped-stories.json could not be read: ${error.message}`];
  }
  return checkSkipped({ reports, skipped, pageSlugs });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const index = args.indexOf(name);
    return index === -1 ? fallback : resolve(args[index + 1] ?? '');
  };
  const files = {
    reportDir: option('--report-dir', join(siteRoot, '.cache', 'story-report')),
    dist: option('--dist', join(siteRoot, 'dist')),
    skippedFile: option('--skipped', join(siteRoot, 'skipped-stories.json')),
  };
  let problems;
  try {
    problems = runCheckSkipped(files);
  } catch (error) {
    console.error(`site:check: ${error.message}`);
    process.exit(1);
  }
  let listed = 0;
  try {
    const list = JSON.parse(readFileSync(files.skippedFile, 'utf8'));
    listed = Array.isArray(list) ? list.length : 0;
  } catch {
    // The problems already name the unreadable file.
  }
  console.log(
    `site:check skipped stories: ${listed} ${listed === 1 ? 'story' : 'stories'} skipped (listed with a reason), ${problems.length} ${problems.length === 1 ? 'problem' : 'problems'}`,
  );
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(problems.length > 0 ? 1 : 0);
}
