import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPageStoryReport, writePageStoryReport } from './storyReport';

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
});
