import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPageStoryReport, clearStoryReports, writePageStoryReport } from './storyReport';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const entry = {
  slug: 'button',
  storyFile: 'stories/Button.stories.tsx',
  storyNames: ['Default', 'Broken'],
};

describe('the story report', () => {
  it('records every story of an entry, with the error of one that did not render', async () => {
    const report = await buildPageStoryReport(entry, async (_slug, name) =>
      name === 'Broken'
        ? { mode: 'inline', serverError: 'window is not defined' }
        : { mode: 'inline' },
    );
    expect(report).toEqual({
      slug: 'button',
      storyFile: 'stories/Button.stories.tsx',
      stories: [
        { story: 'stories/Button.stories.tsx#Default', rendered: true },
        {
          story: 'stories/Button.stories.tsx#Broken',
          rendered: false,
          error: 'window is not defined',
        },
      ],
    });
  });

  it('writes <slug>.json into the directory it is given', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'waveui-report-'));
    dirs.push(dir);
    const report = await buildPageStoryReport(entry, async () => ({ mode: 'inline' }));
    writePageStoryReport(report, join(dir, 'nested'));
    expect(JSON.parse(readFileSync(join(dir, 'nested', 'button.json'), 'utf8'))).toEqual(report);
  });

  it('clearStoryReports removes the directory with every report in it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'waveui-report-'));
    dirs.push(dir);
    const reports = join(dir, 'story-report');
    mkdirSync(reports);
    writeFileSync(join(reports, 'removed-component.json'), '{}');
    writeFileSync(join(reports, 'button.json'), '{}');
    clearStoryReports(reports);
    expect(existsSync(reports)).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('clearStoryReports does nothing when there is no directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'waveui-report-'));
    dirs.push(dir);
    expect(() => clearStoryReports(join(dir, 'never-written'))).not.toThrow();
  });

  it('the Astro configuration clears the reports when a build starts', async () => {
    // The wiring: a stale report of a removed catalog entry must not outlive the next build.
    const { default: config } = (await import('../../astro.config.mjs')) as unknown as {
      default: { integrations: { name: string; hooks: Record<string, unknown> }[] };
    };
    const hooked = config.integrations.filter(
      (integration) => typeof integration.hooks['astro:build:start'] === 'function',
    );
    expect(hooked.map((integration) => integration.name)).toEqual(['waveui-example-islands']);
  });
});
