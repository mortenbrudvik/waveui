// @vitest-environment node
/**
 * `scripts/check-release.mjs`, the first step of the release workflow
 * (.github/workflows/release.yml): the tag, package.json's version and a dated CHANGELOG section
 * agree, the version is not on npm yet, and the section becomes the GitHub release's notes. The
 * checks run against small CHANGELOG and package.json fixtures; the registry is a stub.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  checkRelease,
  checkUnpublished,
  changelogSections,
  githubRepository,
  isCalendarDate,
  main,
  MAX_RELEASE_NOTES,
  parseTag,
  releaseNotes,
} from '../check-release.mjs';

const CHANGELOG = `# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - Unreleased

Work in progress.

## [1.1.0-rc.1] - 2026-09-20

A release candidate.

## [1.1.0] - 2026-09-26

The release. Read the [roadmap](docs/ROADMAP.md) and what [changed](#changed).

### Changed

- A \`[link](in/code)\` stays as written, and so does [the site](https://example.com/docs).

## [1.0.0] - Not published: ships in 1.1.0

Never published on its own.

## [0.9.0] - 2026-02-30

A date that does not exist.

## [0.8.0]

No date at all.

## [0.7.0] - 2026-01-10

## [0.6.0] - 2026-01-05

First.

## [0.6.0] - 2026-01-06

Second.
`;

const pkg = (version, repository = 'git+https://github.com/owner/repo.git') => ({
  name: '@owner/pkg',
  version,
  repository: { type: 'git', url: repository },
});

/** A clean environment: the checks must not pick up the GitHub Actions variables of a CI run. */
const noGitHub = () =>
  Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GITHUB_')));

describe('parseTag', () => {
  it.each([
    ['v0.7.0', '0.7.0', false],
    ['v1.10.100', '1.10.100', false],
    ['v1.0.0-rc.1', '1.0.0-rc.1', true],
    ['v2.0.0-beta-2.x', '2.0.0-beta-2.x', true],
  ])('reads %s as version %s (prerelease %s)', (tag, version, prerelease) => {
    expect(parseTag(tag)).toEqual({ version, prerelease });
  });

  it.each([
    [undefined],
    [''],
    ['0.7.0'],
    ['v0.7'],
    ['v0.7.0.1'],
    ['v01.7.0'],
    ['v0.7.0-'],
    ['v0.7.0-rc..1'],
    ['v0.7.0+build.5'],
    ['refs/tags/v0.7.0'],
    ['release-0.7.0'],
    ['V0.7.0'],
  ])('rejects %s', (tag) => {
    expect(parseTag(tag)).toBeUndefined();
  });
});

describe('isCalendarDate', () => {
  it.each([['2026-09-26'], ['2028-02-29'], ['2026-12-31']])('accepts %s', (date) => {
    expect(isCalendarDate(date)).toBe(true);
  });

  it.each([
    ['2026-02-29'],
    ['2026-02-30'],
    ['2026-13-01'],
    ['2026-00-10'],
    ['2026-9-26'],
    ['2026-09-26T00:00'],
    ['Unreleased'],
    [''],
    [undefined],
  ])('rejects %s', (date) => {
    expect(isCalendarDate(date)).toBe(false);
  });
});

describe('changelogSections', () => {
  it('returns the heading, date text and body of a version, up to the next version heading', () => {
    expect(changelogSections(CHANGELOG, '1.1.0')).toEqual([
      {
        heading: '## [1.1.0] - 2026-09-26',
        date: '2026-09-26',
        body:
          'The release. Read the [roadmap](docs/ROADMAP.md) and what [changed](#changed).\n\n' +
          '### Changed\n\n' +
          '- A `[link](in/code)` stays as written, and so does [the site](https://example.com/docs).',
      },
    ]);
  });

  it('matches the version exactly: dots are not wildcards and a prerelease is its own section', () => {
    expect(changelogSections(CHANGELOG, '1.1.0-rc.1')).toEqual([
      expect.objectContaining({ date: '2026-09-20', body: 'A release candidate.' }),
    ]);
    expect(changelogSections(CHANGELOG, '1x1x0')).toEqual([]);
    expect(changelogSections(CHANGELOG, '1.1')).toEqual([]);
  });

  it('reads the text after the dash as the date, and none without a dash', () => {
    expect(changelogSections(CHANGELOG, '1.2.0')[0].date).toBe('Unreleased');
    expect(changelogSections(CHANGELOG, '1.0.0')[0].date).toBe('Not published: ships in 1.1.0');
    expect(changelogSections(CHANGELOG, '0.8.0')[0].date).toBeUndefined();
  });

  it('reads CRLF line endings like LF', () => {
    expect(changelogSections(CHANGELOG.replace(/\n/g, '\r\n'), '1.1.0')).toEqual(
      changelogSections(CHANGELOG, '1.1.0'),
    );
  });

  it('returns every section of a version that appears twice, and an empty body as ""', () => {
    expect(changelogSections(CHANGELOG, '0.6.0').map((section) => section.body)).toEqual([
      'First.',
      'Second.',
    ]);
    expect(changelogSections(CHANGELOG, '0.7.0')[0].body).toBe('');
  });
});

describe('githubRepository', () => {
  it.each([
    ['git+https://github.com/owner/repo.git'],
    ['https://github.com/owner/repo'],
    ['https://github.com/owner/repo/'],
    ['git+ssh://git@github.com/owner/repo.git'],
    ['git@github.com:owner/repo.git'],
    ['github:owner/repo'],
    ['owner/repo'],
    [{ type: 'git', url: 'git+https://github.com/owner/repo.git' }],
  ])('reads %j as owner/repo', (repository) => {
    expect(githubRepository(repository)).toBe('owner/repo');
  });

  it.each([
    [undefined],
    [''],
    ['https://gitlab.com/owner/repo.git'],
    ['https://github.com/owner'],
    [{ type: 'git' }],
  ])('has no GitHub repository for %j', (repository) => {
    expect(githubRepository(repository)).toBeUndefined();
  });
});

describe('releaseNotes', () => {
  const at = { repository: 'owner/repo', tag: 'v1.1.0' };
  const blob = 'https://github.com/owner/repo/blob/v1.1.0';

  it('points relative links at the tag and heading links at the CHANGELOG there', () => {
    expect(
      releaseNotes(
        'See [the roadmap](docs/ROADMAP.md), [the guide](./docs/guide.md#motion "Motion"), ' +
          '[the readme](/README.md) and [Changed](#changed).',
        at,
      ),
    ).toBe(
      `See [the roadmap](${blob}/docs/ROADMAP.md), [the guide](${blob}/docs/guide.md#motion "Motion"), ` +
        `[the readme](${blob}/README.md) and [Changed](${blob}/CHANGELOG.md#changed).`,
    );
  });

  it('keeps absolute links, and links inside code spans and code blocks', () => {
    const body =
      '[site](https://example.com/a) [mail](mailto:a@example.com) [cdn](//cdn.example.com/x)\n' +
      '`[a](b)` and ``[c](d)``\n\n```md\n[e](f)\n```';
    expect(releaseNotes(body, at)).toBe(body);
  });
});

describe('checkRelease', () => {
  const check = (tag, version = '1.1.0', options = {}) =>
    checkRelease({ tag, pkg: pkg(version), changelog: CHANGELOG, ...options });

  it('passes a tag that matches package.json and a dated CHANGELOG section', () => {
    const result = check('v1.1.0');
    expect(result).toEqual({
      failures: [],
      version: '1.1.0',
      prerelease: false,
      date: '2026-09-26',
      notes: expect.stringContaining(
        '[roadmap](https://github.com/owner/repo/blob/v1.1.0/docs/ROADMAP.md)',
      ),
    });
    expect(result.notes).toContain(
      '[changed](https://github.com/owner/repo/blob/v1.1.0/CHANGELOG.md#changed)',
    );
    expect(result.notes).not.toContain('## [1.1.0]');
  });

  it('passes a prerelease', () => {
    expect(check('v1.1.0-rc.1', '1.1.0-rc.1')).toEqual(
      expect.objectContaining({ failures: [], version: '1.1.0-rc.1', prerelease: true }),
    );
  });

  it('asks for a tag when there is none', () => {
    expect(check(undefined).failures).toEqual([
      'no tag given: pass vX.Y.Z (the release workflow passes GITHUB_REF_NAME)',
    ]);
  });

  it('rejects a tag that is not a version', () => {
    expect(check('main').failures).toEqual([
      'tag main is not v<major>.<minor>.<patch>, optionally with a -<prerelease> suffix',
    ]);
  });

  it('rejects a tag that does not match package.json, and still checks the CHANGELOG', () => {
    expect(check('v1.2.0').failures).toEqual([
      'tag v1.2.0 does not match package.json version 1.1.0: set the version with ' +
        '`npm version 1.2.0 --no-git-tag-version` and commit it, or tag v1.1.0',
      'CHANGELOG.md [1.2.0] is headed "Unreleased" instead of a release date: head it ' +
        '"## [1.2.0] - YYYY-MM-DD" in the release commit',
    ]);
  });

  it('asks for a CHANGELOG section of the version', () => {
    expect(check('v3.0.0', '3.0.0').failures).toEqual([
      'CHANGELOG.md has no "## [3.0.0] - YYYY-MM-DD" section',
    ]);
  });

  it('rejects a section that is not dated, is dated with something else, or with no real date', () => {
    expect(check('v1.0.0', '1.0.0').failures).toEqual([
      'CHANGELOG.md [1.0.0] is headed "Not published: ships in 1.1.0" instead of a release ' +
        'date: head it "## [1.0.0] - YYYY-MM-DD" in the release commit',
    ]);
    expect(check('v0.8.0', '0.8.0').failures).toEqual([
      'CHANGELOG.md [0.8.0] has no release date: head it "## [0.8.0] - YYYY-MM-DD" in the ' +
        'release commit',
    ]);
    expect(check('v0.9.0', '0.9.0').failures).toEqual([
      'CHANGELOG.md [0.9.0] is dated 2026-02-30, which is not a calendar date',
    ]);
  });

  it('rejects an empty section and a version with two sections', () => {
    expect(check('v0.7.0', '0.7.0').failures).toEqual([
      'CHANGELOG.md [0.7.0] is empty: the release notes come from it',
    ]);
    expect(check('v0.6.0', '0.6.0').failures).toEqual(['CHANGELOG.md has 2 sections for 0.6.0']);
  });

  it('rejects release notes longer than a GitHub release allows', () => {
    const changelog = `## [1.1.0] - 2026-09-26\n\n${'x'.repeat(MAX_RELEASE_NOTES + 1)}\n`;
    expect(checkRelease({ tag: 'v1.1.0', pkg: pkg('1.1.0'), changelog }).failures).toEqual([
      `the release notes (CHANGELOG.md [1.1.0]) are ${MAX_RELEASE_NOTES + 1} characters; ` +
        `a GitHub release allows ${MAX_RELEASE_NOTES}`,
    ]);
    const fits = `## [1.1.0] - 2026-09-26\n\n${'x'.repeat(MAX_RELEASE_NOTES)}\n`;
    expect(checkRelease({ tag: 'v1.1.0', pkg: pkg('1.1.0'), changelog: fits }).failures).toEqual(
      [],
    );
  });

  it('checks that package.json names the GitHub repository the release runs in', () => {
    expect(check('v1.1.0', '1.1.0', { repository: 'Owner/Repo' }).failures).toEqual([]);
    expect(check('v1.1.0', '1.1.0', { repository: 'fork/repo' }).failures).toEqual([
      'package.json repository is github.com/owner/repo, but the release runs in ' +
        'github.com/fork/repo: npm rejects provenance from another repository',
    ]);
    expect(
      checkRelease({
        tag: 'v1.1.0',
        pkg: pkg('1.1.0', 'https://gitlab.com/owner/repo.git'),
        changelog: CHANGELOG,
      }).failures,
    ).toEqual([
      'package.json repository ("https://gitlab.com/owner/repo.git") is not a GitHub ' +
        'repository: npm provenance and the links of the release notes need one',
    ]);
  });
});

describe('checkUnpublished', () => {
  const respond = (status) => vi.fn(async () => ({ status }));

  it('asks the registry for the version and passes when it answers 404', async () => {
    const fetch = respond(404);
    expect(await checkUnpublished('@owner/pkg', '1.1.0', { fetch })).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][0])).toBe('https://registry.npmjs.org/@owner%2Fpkg/1.1.0');
  });

  it('fails when the version is on npm', async () => {
    expect(await checkUnpublished('@owner/pkg', '1.1.0', { fetch: respond(200) })).toEqual([
      '@owner/pkg@1.1.0 is already on npm (https://registry.npmjs.org/@owner%2Fpkg/1.1.0), ' +
        'and a published version cannot be replaced: release a new version',
    ]);
  });

  it('fails when the registry cannot say, rather than guessing', async () => {
    expect(await checkUnpublished('pkg', '1.1.0', { fetch: respond(503) })).toEqual([
      'the npm registry answered HTTP 503 for https://registry.npmjs.org/pkg/1.1.0, so it is ' +
        'unknown whether pkg@1.1.0 is published: run the release again',
    ]);
    const offline = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND registry.npmjs.org');
    });
    expect(await checkUnpublished('pkg', '1.1.0', { fetch: offline })).toEqual([
      'could not reach the npm registry to check that pkg@1.1.0 is unpublished ' +
        '(getaddrinfo ENOTFOUND registry.npmjs.org)',
    ]);
  });
});

describe('main', () => {
  let dir;
  let files;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'check-release-'));
    files = {
      changelog: join(dir, 'CHANGELOG.md'),
      pkg: join(dir, 'package.json'),
      notes: join(dir, 'out', 'notes.md'),
      output: join(dir, 'github-output'),
    };
    writeFileSync(files.changelog, CHANGELOG);
    writeFileSync(files.pkg, JSON.stringify(pkg('1.1.0')));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** Runs main with the fixtures, an empty environment unless given, and a stub registry. */
  async function run(args, { env = {}, status = 404 } = {}) {
    rmSync(files.notes, { force: true });
    rmSync(files.output, { force: true });
    const out = [];
    const err = [];
    const io = { log: (line) => out.push(line), error: (line) => err.push(line) };
    const fetch = vi.fn(async () => ({ status }));
    const code = await main([...args, '--changelog', files.changelog, '--package', files.pkg], {
      io,
      env,
      fetch,
    });
    return { code, out, err, fetch };
  }

  it('writes the notes and the step outputs, and reports what it checked', async () => {
    const { code, out, err, fetch } = await run([
      'v1.1.0',
      '--registry',
      '--notes',
      files.notes,
      '--output',
      files.output,
    ]);
    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    const notes = readFileSync(files.notes, 'utf8');
    expect(notes).toMatch(
      /^The release\. Read the \[roadmap\]\(https:\/\/github\.com\/owner\/repo\/blob\/v1\.1\.0\/docs\/ROADMAP\.md\)/,
    );
    expect(
      notes.endsWith(
        '`[link](in/code)` stays as written, and so does [the site](https://example.com/docs).\n',
      ),
    ).toBe(true);
    expect(readFileSync(files.output, 'utf8')).toBe(
      'version=1.1.0\ndate=2026-09-26\nprerelease=false\n',
    );
    expect(out).toEqual([
      `check-release: v1.1.0 can be released: package.json 1.1.0, CHANGELOG.md [1.1.0] of ` +
        `2026-09-26, release notes of ${notes.length - 1} characters, not on npm yet`,
    ]);
  });

  it('reads the tag and the repository from the GitHub Actions environment', async () => {
    const { code, out } = await run([], {
      env: { GITHUB_REF_NAME: 'v1.1.0', GITHUB_REPOSITORY: 'owner/repo' },
    });
    expect(code).toBe(0);
    expect(out[0]).toMatch(/^check-release: v1\.1\.0 can be released: .*characters$/);

    const fork = await run([], {
      env: { GITHUB_REF_NAME: 'v1.1.0', GITHUB_REPOSITORY: 'fork/repo' },
    });
    expect(fork.code).toBe(1);
    expect(fork.err.join('\n')).toContain('the release runs in github.com/fork/repo');
  });

  it('writes nothing and exits 1 when a check fails, listing every failure', async () => {
    const { code, out, err, fetch } = await run(
      ['v1.2.0', '--registry', '--notes', files.notes, '--output', files.output],
      { status: 200 },
    );
    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual([
      'check-release: v1.2.0 cannot be released:',
      expect.stringMatching(/^ {2}- tag v1\.2\.0 does not match package\.json version 1\.1\.0/),
      expect.stringMatching(/^ {2}- CHANGELOG\.md \[1\.2\.0\] is headed "Unreleased"/),
      expect.stringMatching(/^ {2}- @owner\/pkg@1\.2\.0 is already on npm/),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(existsSync(files.notes)).toBe(false);
    expect(existsSync(files.output)).toBe(false);
  });

  it('asks the registry only with --registry, and only for a version it could read', async () => {
    expect((await run(['v1.1.0'])).fetch).not.toHaveBeenCalled();
    expect((await run(['main', '--registry'])).fetch).not.toHaveBeenCalled();
  });

  it('annotates each failure in GitHub Actions', async () => {
    const { code, out } = await run(['v3.0.0'], { env: { GITHUB_ACTIONS: 'true' } });
    expect(code).toBe(1);
    expect(out).toEqual([
      '::error title=check-release::tag v3.0.0 does not match package.json version 1.1.0: set ' +
        'the version with `npm version 3.0.0 --no-git-tag-version` and commit it, or tag v1.1.0',
      '::error title=check-release::CHANGELOG.md has no "## [3.0.0] - YYYY-MM-DD" section',
    ]);
  });

  it('rejects unknown arguments, a second tag and a missing value, with the usage', async () => {
    for (const args of [
      ['v1.1.0', '--dry-run'],
      ['v1.1.0', 'v1.1.1'],
      ['v1.1.0', '--notes'],
    ]) {
      // run() appends --changelog <file>, so `--notes` is followed by another option here.
      const { code, err } = await run(args);
      expect(code).toBe(1);
      expect(err[0]).toMatch(/^check-release: (unknown argument|--notes needs a value)/);
      expect(err[1]).toMatch(/^Usage: node scripts\/check-release\.mjs/);
    }
  });

  it('reports a file it cannot read', async () => {
    const out = [];
    const err = [];
    const io = { log: (line) => out.push(line), error: (line) => err.push(line) };
    const missing = join(dir, 'missing.md');
    const code = await main(['v1.1.0', '--changelog', missing, '--package', files.pkg], {
      io,
      env: {},
      fetch: vi.fn(),
    });
    expect(code).toBe(1);
    expect(err).toEqual([
      expect.stringMatching(/^check-release: cannot read .*missing\.md \(ENOENT/),
    ]);
  });
});

describe('check-release.mjs as a script', () => {
  const script = fileURLToPath(new URL('../check-release.mjs', import.meta.url));
  let dir;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'check-release-script-'));
    writeFileSync(join(dir, 'CHANGELOG.md'), CHANGELOG);
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg('1.1.0')));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const runScript = (args, env = noGitHub()) =>
    spawnSync(
      process.execPath,
      [
        script,
        ...args,
        '--changelog',
        join(dir, 'CHANGELOG.md'),
        '--package',
        join(dir, 'package.json'),
      ],
      { encoding: 'utf8', env },
    );

  it('exits 0 for a releasable tag and 1 otherwise', () => {
    const notes = join(dir, 'notes.md');
    const ok = runScript(['v1.1.0', '--notes', notes]);
    expect(ok.stderr).toBe('');
    expect(ok.stdout).toMatch(/^check-release: v1\.1\.0 can be released/);
    expect(ok.status).toBe(0);
    expect(readFileSync(notes, 'utf8')).toMatch(/^The release\./);

    const bad = runScript(['v1.2.0']);
    expect(bad.stderr).toMatch(/^check-release: v1\.2\.0 cannot be released:\n {2}- tag v1\.2\.0/);
    expect(bad.status).toBe(1);
  }, 60_000);

  it('fails closed when it cannot confirm that it is the script Node was started with', () => {
    const impostor = join(dir, 'check-release.mjs');
    writeFileSync(impostor, `import ${JSON.stringify(pathToFileURL(script).href)};\n`);
    const result = spawnSync(process.execPath, [impostor, 'v1.1.0'], {
      encoding: 'utf8',
      env: noGitHub(),
    });
    expect(result.stderr).toContain(
      `check-release: cannot confirm that ${impostor} is ${script}; nothing was checked`,
    );
    expect(result.status).toBe(1);
  }, 60_000);
});
