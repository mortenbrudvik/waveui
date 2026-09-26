#!/usr/bin/env node
/**
 * Checks that a tag can be released, before anything is built or published (the first step of
 * .github/workflows/release.yml; docs/RELEASING.md).
 *
 * Checks:
 *   - the tag is `v` + a semantic version (`v0.7.0`, `v1.0.0-rc.1`; no build metadata) and equals
 *     `v` + package.json's version;
 *   - CHANGELOG.md has exactly one section for that version, headed `## [X.Y.Z] - YYYY-MM-DD` with
 *     a real calendar date, and it is not empty: a section still headed `Unreleased` (or
 *     `Not published`) fails, so the release commit dates it;
 *   - package.json's `repository` is a GitHub repository, and the one the release runs in
 *     (`--repository`, by default `GITHUB_REPOSITORY`) when that is known: npm rejects provenance
 *     from another repository;
 *   - the release notes fit a GitHub release ({@link MAX_RELEASE_NOTES} characters);
 *   - with `--registry`: the version is not on the npm registry yet. A published version can never
 *     be replaced (npm keeps its number even after an unpublish), so a tag of one fails here instead
 *     of after the gate.
 *
 * The release notes are the section's body without its heading. Relative links are made absolute
 * at the tag, since they would not resolve on the release page: `docs/ROADMAP.md` becomes
 * `https://github.com/<owner>/<repo>/blob/<tag>/docs/ROADMAP.md`, and a heading link such as
 * `#changed` points at CHANGELOG.md there. Links inside code spans and code blocks stay as written.
 *
 * Usage: node scripts/check-release.mjs [<tag>] [--registry] [--notes <file>] [--output <file>]
 *   [--repository <owner/repo>] [--changelog <file>] [--package <file>]
 *   <tag>         the tag to release (default: GITHUB_REF_NAME)
 *   --registry    also check that the version is not on https://registry.npmjs.org/ yet
 *   --notes       write the release notes to this file
 *   --output      append `version=`, `date=` and `prerelease=` lines to this file (the workflow
 *                 passes $GITHUB_OUTPUT)
 *   --repository  the GitHub repository the release runs in (default: GITHUB_REPOSITORY)
 *   --changelog   default: CHANGELOG.md of the repository; --package: its package.json
 * Exit code 0 when every check passed (the files are written only then), 1 otherwise. In GitHub
 * Actions (GITHUB_ACTIONS=true) each failure is also printed as an error annotation.
 *
 * The checks are exported for scripts/__tests__/check-release.test.mjs; importing the module does
 * not run them. It imports only Node.js builtins, so the workflow runs it before `npm ci`, and it
 * starts through verify-dist's `runScript`, so a script of its name that cannot be matched to this
 * file fails instead of passing unchecked.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScript } from './verify-dist.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The longest body GitHub accepts for a release. */
export const MAX_RELEASE_NOTES = 125_000;

/** The registry the release workflow publishes to (npm's default). */
export const NPM_REGISTRY = 'https://registry.npmjs.org/';

const USAGE =
  'Usage: node scripts/check-release.mjs [<tag>] [--registry] [--notes <file>] [--output <file>] ' +
  '[--repository <owner/repo>] [--changelog <file>] [--package <file>]';

// A semantic version without build metadata: numeric parts without leading zeros, and dot-separated
// prerelease identifiers (numeric ones without leading zeros).
const NUMBER = '(?:0|[1-9]\\d*)';
const IDENTIFIER = `(?:${NUMBER}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
const TAG = new RegExp(
  `^v(${NUMBER}\\.${NUMBER}\\.${NUMBER}(?:-(${IDENTIFIER}(?:\\.${IDENTIFIER})*))?)$`,
);

/**
 * The version of a release tag (`v0.7.0` → `0.7.0`) and whether it is a prerelease
 * (`v1.0.0-rc.1`); undefined for anything else.
 */
export function parseTag(tag) {
  const match = TAG.exec(typeof tag === 'string' ? tag : '');
  return match ? { version: match[1], prerelease: match[2] !== undefined } : undefined;
}

/** Whether `text` is a `YYYY-MM-DD` date that exists in the calendar (no 2026-02-29). */
export function isCalendarDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof text === 'string' ? text : '');
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Every section of CHANGELOG.md for `version` (Keep a Changelog: `## [0.7.0] - 2026-09-26`), in
 * file order: its heading line, the text after ` - ` (`date`, undefined without a dash) and its
 * body up to the next level-1 or level-2 heading, trimmed.
 */
export function changelogSections(changelog, version) {
  const lines = changelog.replace(/\r\n?/g, '\n').split('\n');
  const heading = new RegExp(`^## \\[${escapeRegExp(version)}\\](?:\\s+-\\s+(.*?))?\\s*$`);
  const sections = [];
  lines.forEach((line, index) => {
    const match = heading.exec(line);
    if (!match) return;
    let end = lines.findIndex((next, i) => i > index && /^#{1,2} /.test(next));
    if (end === -1) end = lines.length;
    sections.push({
      heading: line.trimEnd(),
      date: match[1] || undefined,
      body: lines
        .slice(index + 1, end)
        .join('\n')
        .trim(),
    });
  });
  return sections;
}

/**
 * The `owner/repo` of a package.json `repository` (a string or `{ url }`) on GitHub, in any of
 * npm's forms (`git+https://github.com/o/r.git`, `git@github.com:o/r.git`, `github:o/r`, `o/r`);
 * undefined for anything else.
 */
export function githubRepository(repository) {
  const url = typeof repository === 'string' ? repository : repository?.url;
  if (typeof url !== 'string') return undefined;
  const patterns = [
    /^(?:git\+)?(?:https?|ssh|git):\/\/(?:[^@/]+@)?github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i,
    /^github:([^/]+)\/([^/]+?)(?:\.git)?$/i,
    /^([\w.-]+)\/([\w.-]+)$/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(url.trim());
    if (match) return `${match[1]}/${match[2]}`;
  }
  return undefined;
}

/**
 * The release notes of a CHANGELOG section body: relative links point at the files as of `tag`,
 * and heading links (`#changed`) at `changelogFile` there. Absolute links (`https:`, `mailto:`,
 * `//host`) and anything inside a code span or code block stay as written.
 */
export function releaseNotes(body, { repository, tag, changelogFile = 'CHANGELOG.md' }) {
  const base = `https://github.com/${repository}/blob/${tag}/`;
  return body.replace(
    /(`+)[\s\S]*?\1|(\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g,
    (match, ticks, open, target, rest) => {
      if (ticks !== undefined) return match;
      if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) return match;
      const path = target.startsWith('#')
        ? `${changelogFile}${target}`
        : target.replace(/^\.?\//, '');
      return `${open}${base}${path}${rest}`;
    },
  );
}

/**
 * Checks a release (see the module comment) without the registry. `pkg` is the parsed
 * package.json, `changelog` the CHANGELOG text, `repository` the `owner/repo` the release runs
 * in (optional). Returns the failures and, when the section could be read, the version, whether
 * it is a prerelease, the section's date and the release notes.
 */
export function checkRelease({ tag, pkg, changelog, repository, changelogFile = 'CHANGELOG.md' }) {
  if (!tag) {
    return {
      failures: ['no tag given: pass vX.Y.Z (the release workflow passes GITHUB_REF_NAME)'],
    };
  }
  const parsed = parseTag(tag);
  if (!parsed) {
    return {
      failures: [
        `tag ${tag} is not v<major>.<minor>.<patch>, optionally with a -<prerelease> suffix`,
      ],
    };
  }
  const { version, prerelease } = parsed;
  const failures = [];

  if (pkg.version !== version) {
    failures.push(
      `tag ${tag} does not match package.json version ${pkg.version}: set the version with ` +
        `\`npm version ${version} --no-git-tag-version\` and commit it, or tag v${pkg.version}`,
    );
  }

  const ownRepository = githubRepository(pkg.repository);
  if (!ownRepository) {
    const shown = JSON.stringify(pkg.repository?.url ?? pkg.repository ?? null);
    failures.push(
      `package.json repository (${shown}) is not a GitHub repository: npm provenance and the ` +
        'links of the release notes need one',
    );
  } else if (repository && ownRepository.toLowerCase() !== repository.toLowerCase()) {
    failures.push(
      `package.json repository is github.com/${ownRepository}, but the release runs in ` +
        `github.com/${repository}: npm rejects provenance from another repository`,
    );
  }

  const dated = `"## [${version}] - YYYY-MM-DD"`;
  const sections = changelogSections(changelog, version);
  let section;
  if (sections.length === 0) {
    failures.push(`${changelogFile} has no ${dated} section`);
  } else if (sections.length > 1) {
    failures.push(`${changelogFile} has ${sections.length} sections for ${version}`);
  } else {
    [section] = sections;
    if (section.date === undefined) {
      failures.push(
        `${changelogFile} [${version}] has no release date: head it ${dated} in the release commit`,
      );
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(section.date)) {
      failures.push(
        `${changelogFile} [${version}] is headed "${section.date}" instead of a release date: ` +
          `head it ${dated} in the release commit`,
      );
    } else if (!isCalendarDate(section.date)) {
      failures.push(
        `${changelogFile} [${version}] is dated ${section.date}, which is not a calendar date`,
      );
    }
    if (section.body === '') {
      failures.push(`${changelogFile} [${version}] is empty: the release notes come from it`);
    }
  }

  let notes;
  if (section && section.body !== '' && ownRepository) {
    notes = releaseNotes(section.body, { repository: ownRepository, tag, changelogFile });
    if (notes.length > MAX_RELEASE_NOTES) {
      failures.push(
        `the release notes (${changelogFile} [${version}]) are ${notes.length} characters; ` +
          `a GitHub release allows ${MAX_RELEASE_NOTES}`,
      );
    }
  }

  return { failures, version, prerelease, date: section?.date, notes };
}

/**
 * Checks that `name@version` is not on the registry: the version document answers 404. A 200 is a
 * published version; any other answer, or no answer, fails too, since it proves nothing. Returns
 * the failures.
 */
export async function checkUnpublished(
  name,
  version,
  { fetch = globalThis.fetch, registry = NPM_REGISTRY, timeout = 30_000 } = {},
) {
  const url = new URL(`${name.replace('/', '%2F')}/${encodeURIComponent(version)}`, registry).href;
  let status;
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeout),
    });
    status = response.status;
    await response.body?.cancel?.();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return [
      `could not reach the npm registry to check that ${name}@${version} is unpublished (${reason})`,
    ];
  }
  if (status === 404) return [];
  if (status === 200) {
    return [
      `${name}@${version} is already on npm (${url}), and a published version cannot be ` +
        'replaced: release a new version',
    ];
  }
  return [
    `the npm registry answered HTTP ${status} for ${url}, so it is unknown whether ` +
      `${name}@${version} is published: run the release again`,
  ];
}

function parseArgs(argv, env) {
  const options = {
    tag: env.GITHUB_REF_NAME || undefined,
    repository: env.GITHUB_REPOSITORY || undefined,
    registry: false,
    notes: undefined,
    output: undefined,
    changelog: join(root, 'CHANGELOG.md'),
    pkg: join(root, 'package.json'),
  };
  let tagGiven = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === '--registry') options.registry = true;
    else if (arg === '--notes') options.notes = resolve(value());
    else if (arg === '--output') options.output = resolve(value());
    else if (arg === '--repository') options.repository = value();
    else if (arg === '--changelog') options.changelog = resolve(value());
    else if (arg === '--package') options.pkg = resolve(value());
    else if (!arg.startsWith('-') && !tagGiven) {
      options.tag = arg;
      tagGiven = true;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

/** A workflow command's message: `%`, CR and LF are escaped, as GitHub Actions expects. */
const annotation = (message) =>
  `::error title=check-release::${message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`;

/**
 * CLI entry; returns the exit code. `io` receives the report, `env` holds the GitHub Actions
 * variables and `fetch` asks the registry (defaults: the console, process.env, global fetch).
 */
export async function main(
  argv = process.argv.slice(2),
  { io = console, env = process.env, fetch = globalThis.fetch } = {},
) {
  let options;
  try {
    options = parseArgs(argv, env);
  } catch (error) {
    io.error(`check-release: ${error.message}`);
    io.error(USAGE);
    return 1;
  }

  let pkg;
  let changelog;
  try {
    pkg = JSON.parse(readFileSync(options.pkg, 'utf8'));
    changelog = readFileSync(options.changelog, 'utf8');
  } catch (error) {
    const file = pkg === undefined ? options.pkg : options.changelog;
    io.error(`check-release: cannot read ${file} (${error.message.split('\n')[0]})`);
    return 1;
  }

  const changelogFile = basename(options.changelog);
  const result = checkRelease({
    tag: options.tag,
    pkg,
    changelog,
    repository: options.repository,
    changelogFile,
  });
  const failures = [...result.failures];
  if (options.registry && result.version !== undefined) {
    failures.push(...(await checkUnpublished(pkg.name, result.version, { fetch })));
  }

  if (failures.length > 0) {
    if (env.GITHUB_ACTIONS === 'true') for (const failure of failures) io.log(annotation(failure));
    io.error(`check-release: ${options.tag ?? '(no tag)'} cannot be released:`);
    for (const failure of failures) io.error(`  - ${failure}`);
    return 1;
  }

  if (options.notes) {
    mkdirSync(dirname(options.notes), { recursive: true });
    writeFileSync(options.notes, `${result.notes}\n`);
  }
  if (options.output) {
    appendFileSync(
      options.output,
      `version=${result.version}\ndate=${result.date}\nprerelease=${result.prerelease}\n`,
    );
  }
  io.log(
    `check-release: ${options.tag} can be released: package.json ${pkg.version}, ` +
      `${changelogFile} [${result.version}] of ${result.date}, release notes of ` +
      `${result.notes.length} characters${options.registry ? ', not on npm yet' : ''}`,
  );
  return 0;
}

await runScript(import.meta.url, main);
