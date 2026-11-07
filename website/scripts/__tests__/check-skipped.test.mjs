/**
 * The skipped-stories gate (`scripts/check-skipped.mjs`): the build's story report against
 * `skipped-stories.json`. Fixtures are reports and lists in a temp directory; the last suite reads
 * the real build, following `test/builtSite.ts` for when that is possible.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { requireBuiltSiteUnlessOptional, SITE_DIST } from '../../test/builtSite';
import { checkSkipped, runCheckSkipped } from '../check-skipped.mjs';

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(SITE_ROOT, 'scripts', 'check-skipped.mjs');

const FILE = 'stories/Button.stories.tsx';
const story = (name) => `${FILE}#${name}`;
const report = (stories, slug = 'button') => ({
  slug,
  storyFile: FILE,
  stories: stories.map(([name, rendered, error]) => ({
    story: story(name),
    rendered,
    ...(error ? { error } : {}),
  })),
});
const REASON = 'reads the layout of the page during render, which has no layout on the server';

describe('checkSkipped', () => {
  it('passes when every story renders or is listed, and every listed story fails to render', () => {
    const reports = [
      report([
        ['Default', true],
        ['Measured', false, 'no layout'],
      ]),
    ];
    const skipped = [{ story: story('Measured'), reason: REASON }];
    expect(checkSkipped({ reports, skipped })).toEqual([]);
  });

  it('check-skipped fails when a story is neither rendered nor listed', () => {
    const reports = [
      report([
        ['Default', true],
        ['Measured', false, 'window is not defined'],
      ]),
    ];
    const problems = checkSkipped({ reports, skipped: [] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(story('Measured'));
    expect(problems[0]).toContain('window is not defined');
    expect(problems[0]).toContain('skipped-stories.json');
  });

  it('check-skipped fails on a stale entry and on a missing reason', () => {
    const reports = [
      report([
        ['Default', true],
        ['Fixed', true],
        ['Measured', false, 'x'],
      ]),
    ];
    const skipped = [
      { story: story('Measured'), reason: '   ' },
      { story: story('Fixed'), reason: REASON },
      { story: story('Removed'), reason: REASON },
      { story: story('Measured') },
    ];
    const text = checkSkipped({ reports, skipped }).join('\n');
    expect(text).toContain(`${story('Fixed')} renders now`);
    expect(text).toContain(`${story('Removed')} is not a story of the catalog`);
    expect(text).toContain(`${story('Measured')} has no reason`);
    expect(text).toContain(`${story('Measured')} is listed twice`);
  });

  it('a malformed list is a problem, not a crash', () => {
    const reports = [report([['Default', true]])];
    expect(checkSkipped({ reports, skipped: {} }).join('\n')).toContain('array');
    expect(checkSkipped({ reports, skipped: [null, { reason: REASON }] }).join('\n')).toContain(
      'story',
    );
  });

  it('the report must cover exactly the pages of the build', () => {
    const reports = [report([['Default', true]], 'button')];
    const missing = checkSkipped({ reports, skipped: [], pageSlugs: ['button', 'menu'] }).join(
      '\n',
    );
    expect(missing).toContain('menu');
    expect(missing).toContain('run npm run site:build first');
    const extra = checkSkipped({ reports, skipped: [], pageSlugs: [] }).join('\n');
    expect(extra).toContain('button');
    expect(checkSkipped({ reports, skipped: [], pageSlugs: ['button'] })).toEqual([]);
  });
});

describe('the command line', () => {
  const dirs = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function site({ reports, skipped, pages = reports?.map((item) => item.slug) }) {
    const root = mkdtempSync(join(tmpdir(), 'waveui-skipped-'));
    dirs.push(root);
    const reportDir = join(root, 'story-report');
    if (reports) {
      mkdirSync(reportDir);
      for (const item of reports)
        writeFileSync(join(reportDir, `${item.slug}.json`), JSON.stringify(item));
    }
    const dist = join(root, 'dist');
    mkdirSync(join(dist, 'components'), { recursive: true });
    for (const slug of pages ?? []) writeFileSync(join(dist, 'components', `${slug}.html`), '');
    const skippedFile = join(root, 'skipped-stories.json');
    writeFileSync(skippedFile, JSON.stringify(skipped));
    return { reportDir, dist, skippedFile };
  }

  const run = ({ reportDir, dist, skippedFile }) =>
    spawnSync(
      process.execPath,
      [SCRIPT, '--report-dir', reportDir, '--dist', dist, '--skipped', skippedFile],
      {
        encoding: 'utf8',
      },
    );

  it('exits 0 and says so when the stories agree with the list', () => {
    const result = run(
      site({
        reports: [
          report([
            ['Default', true],
            ['Measured', false, 'x'],
          ]),
        ],
        skipped: [{ story: story('Measured'), reason: REASON }],
      }),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1 story skipped');
  });

  it('exits 1 naming the story when one is neither rendered nor listed', () => {
    const result = run(site({ reports: [report([['Measured', false, 'boom']])], skipped: [] }));
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(story('Measured'));
  });

  it('exits 1 with a clear message when the build wrote no report', () => {
    const result = run(site({ reports: undefined, skipped: [] }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('run npm run site:build first');
  });

  it('runCheckSkipped returns the problems for a report directory', () => {
    const files = site({ reports: [report([['Measured', false, 'boom']])], skipped: [] });
    expect(runCheckSkipped(files)).toHaveLength(1);
  });
});

const state = requireBuiltSiteUnlessOptional();
describe.skipIf(!state.ready)(
  state.ready ? 'the real build' : `the real build (skipped: ${state.reason})`,
  () => {
    it('renders every story of the catalog or lists it with a reason', () => {
      const problems = runCheckSkipped({
        reportDir: join(SITE_ROOT, '.cache', 'story-report'),
        dist: SITE_DIST,
        skippedFile: join(SITE_ROOT, 'skipped-stories.json'),
      });
      expect(problems).toEqual([]);
    });
  },
);
