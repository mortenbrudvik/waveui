/**
 * The build's report of which stories the site could render, for `scripts/check-skipped.mjs`
 * (`npm run site:check`). Each component page writes `website/.cache/story-report/<slug>.json`
 * (git-ignored) while it builds: for every story of its catalog entry, the skipped ones included,
 * whether the server render of its default args succeeded (the analysis of `analysis.tsx`, the
 * one that decides whether an example shows its error panel) and the message if not.
 *
 * Why a file per page written by the page, and not a registry read at the end of the build:
 * the check runs in a later process, and a page's own file needs no shared state between the
 * build's bundles (the config, the prerender chunks) nor a hook order. The check compares the
 * files with the pages of `dist`; the build clears the directory when it starts
 * ({@link clearStoryReports}), so a file left from a removed catalog entry cannot outlive it.
 *
 * Build-time code; never sent to the browser.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ComponentEntry } from '../catalog/catalog';
import { REPO_ROOT } from '../repoRoot';
import type { ExampleAnalysis } from './analysis';

/** Where the reports are written, from the repository root. */
export const STORY_REPORT_DIR = 'website/.cache/story-report';

export interface StoryReportItem {
  /** `<storyFile>#<ExportName>`. */
  story: string;
  /** Whether the server render of the story succeeded. */
  rendered: boolean;
  /** The message of the error it threw, when it did not. */
  error?: string;
}

export interface PageStoryReport {
  slug: string;
  storyFile: string;
  stories: StoryReportItem[];
}

/** Analyses every story of `entry` (listed as skipped or not) with `analyze`. */
export async function buildPageStoryReport(
  entry: Pick<ComponentEntry, 'slug' | 'storyFile' | 'storyNames'>,
  analyze: (slug: string, storyName: string) => Promise<ExampleAnalysis>,
): Promise<PageStoryReport> {
  const stories: StoryReportItem[] = [];
  for (const name of entry.storyNames) {
    const { serverError } = await analyze(entry.slug, name);
    const story = `${entry.storyFile}#${name}`;
    stories.push(
      serverError === undefined
        ? { story, rendered: true }
        : { story, rendered: false, error: serverError },
    );
  }
  return { slug: entry.slug, storyFile: entry.storyFile, stories };
}

/** Writes a page's report to `<dir>/<slug>.json`. */
export function writePageStoryReport(
  report: PageStoryReport,
  dir: string = join(REPO_ROOT, STORY_REPORT_DIR),
): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${report.slug}.json`), `${JSON.stringify(report, null, 2)}\n`);
}

/** Removes the reports directory (and every report in it); nothing happens when it is absent. */
export function clearStoryReports(dir: string = join(REPO_ROOT, STORY_REPORT_DIR)): void {
  rmSync(dir, { recursive: true, force: true });
}
