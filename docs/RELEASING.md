# Releasing @mortenbrudvik/waveui

Releases are published by GitHub Actions, never from a local machine. Pushing a tag `vX.Y.Z` runs [`.github/workflows/release.yml`](../.github/workflows/release.yml):

1. **verify** checks that the tagged commit is on `main`, runs [`scripts/check-release.mjs`](../scripts/check-release.mjs) (the tag is `v` + the `package.json` version, `CHANGELOG.md` has a section `## [X.Y.Z] - YYYY-MM-DD` with a real date, `package.json` names this repository, and the version is not on npm yet), runs the full gate of [docs/ROADMAP.md §3](ROADMAP.md#3-process-per-release) (the `prepublishOnly` commands plus lint, formatting and a Storybook build) and packs the tarball.
2. **publish** publishes that tarball to npm through [trusted publishing](https://docs.npmjs.com/trusted-publishers): npm exchanges a short-lived OIDC token of the workflow for a publish token, so no npm token is stored anywhere, and attaches a provenance attestation that links the package to the commit and the workflow run that built it. This job checks out nothing and installs no dependencies. A prerelease (`v1.0.0-rc.1`) goes to the `next` dist-tag, anything else to `latest`.
3. **github-release** creates the GitHub release: the CHANGELOG section is its notes (relative links made absolute at the tag) and the tarball is attached.

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs the same gate on every push to `main` and every pull request.

## Release steps

On a branch from `main`:

1. **Set the version**, unless `package.json` already has it:

   ```bash
   npm version 0.8.0 --no-git-tag-version
   ```

   This updates `package.json` and `package-lock.json` without a commit or a tag.

2. **Date the CHANGELOG section**: `## [0.8.0] - Unreleased` becomes `## [0.8.0] - 2026-10-15`, the day you tag. Then check the release as the workflow will:

   ```bash
   node scripts/check-release.mjs v0.8.0 --registry
   ```

3. **Commit** (`chore(release): 0.8.0`), open a pull request, and merge it once CI passes.

Then tag the merged commit on `main` and push the tag:

```bash
git switch main
git pull --ff-only
git tag -a v0.8.0 -m "v0.8.0"
git push origin v0.8.0
```

Follow the run with `gh run watch` (or the Actions tab). It takes 10 to 15 minutes, most of it the gate.

## Verifying a release

```bash
npm view @mortenbrudvik/waveui@0.8.0 dist.attestations _npmUser --json
npm view @mortenbrudvik/waveui dist-tags
```

The first shows the attestations URL with `"predicateType": "https://slsa.dev/provenance/v1"` and `_npmUser` `GitHub Actions <npm-oidc-no-reply@github.com>` (a publish from a person's account shows that account instead). The package page on npmjs.com shows the provenance: the source commit, the build file and the workflow run.

To check the signatures and the attestation as a consumer does, in an empty directory:

```bash
npm init -y
npm install @mortenbrudvik/waveui@0.8.0 react react-dom
npm audit signatures
```

It reports the packages with verified registry signatures and those with verified attestations; Wave must be among the latter (`npm audit signatures --json --include-attestations` lists them).

## When a release fails

- **verify fails** (the tag does not match, the CHANGELOG section is not dated, a gate step fails): nothing was published. Fix it on `main`, delete the tag and tag the fixed commit:

  ```bash
  git push origin --delete v0.8.0
  git tag -d v0.8.0
  ```

- **publish fails with `E404 Not Found` or `ENEEDAUTH`**: npm did not accept the OIDC token, so the trusted publisher does not match the workflow. It must name the repository `mortenbrudvik/waveui`, the workflow file `release.yml` and the environment `npm`, all case-sensitive. Check it with `npm trust list @mortenbrudvik/waveui`, fix it (a configuration cannot be edited: `npm trust revoke @mortenbrudvik/waveui --id=<id>`, then create it again as below), and use **Re-run failed jobs** on the run: the packed tarball is kept for 7 days.
- **publish fails after the upload reached npm** (a network error after the upload, for example): **Re-run failed jobs**. The publish job finds the same tarball on npm (same integrity) and skips the upload, so the GitHub release still runs; a different tarball under that version fails the job.
- **github-release fails** after the publish: **Re-run failed jobs**. The job creates the release, or updates the notes and the tarball of one that exists.
- **Re-run all jobs** of a published release fails in verify: the version is on npm. Re-run only the failed jobs.
- **A broken package on npm** cannot be replaced: a version number is used up once published, even after an unpublish. Release a patch version.

The workflow always publishes a release to `latest`, which npm refuses to move back to a lower version: a patch of an older line (0.7.1 after 0.8.0) fails in publish and needs its own dist-tag, which the workflow does not offer yet.

## One-time setup

The maintainer does these once, in this order, before the first tag. `npm trust` asks for two-factor authentication in the browser, so it runs in your own terminal (it cannot run from an agent's shell).

1. **The `npm` environment**, limited to `v*` tags, so only a release tag can run the publish job:

   ```bash
   gh api -X PUT repos/mortenbrudvik/waveui/environments/npm -F "deployment_branch_policy[protected_branches]=false" -F "deployment_branch_policy[custom_branch_policies]=true"
   gh api -X POST repos/mortenbrudvik/waveui/environments/npm/deployment-branch-policies -f name="v*" -f type=tag
   ```

   Or in the repository's Settings → Environments → New environment `npm` → Deployment branches and tags → Selected branches and tags → add the tag rule `v*`. A required reviewer there would make every release wait for an approval.

2. **The trusted publisher** on npm (npm 11.15 or later; the package must exist, which it does since 0.4.0):

   ```bash
   npm trust github @mortenbrudvik/waveui --file release.yml --repository mortenbrudvik/waveui --environment npm --allow-publish --yes
   npm trust list @mortenbrudvik/waveui
   ```

   The list shows the file `release.yml`, the repository `mortenbrudvik/waveui`, the environment `npm` and the permission to publish. Or on npmjs.com: the package → Settings → Trusted publishing → GitHub Actions, with the owner `mortenbrudvik`, the repository `waveui`, the workflow `release.yml`, the environment `npm`, and direct publishing allowed.

3. **After the first release** shows its provenance: on npmjs.com, the package → Settings → Publishing access → **Require two-factor authentication and disallow tokens**, and revoke npm tokens that are no longer used. Trusted publishing keeps working; a leaked token can no longer publish.

Optional: a branch ruleset for `main` that requires the CI check `Gate (Linux, Node 24)`, and a tag ruleset that restricts creating, updating and deleting `v*` tags to the maintainer.

`package.json`'s `repository.url` must keep pointing at `github.com/mortenbrudvik/waveui`: npm rejects provenance from another repository, and `check-release` fails first.
