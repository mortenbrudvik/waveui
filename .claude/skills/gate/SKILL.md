---
name: gate
description: Use when a WaveUI phase, fix round or release branch looks finished and needs the exit gate of docs/ROADMAP.md §3 before it is merged or released — not after single edits, which the hooks and focused test runs cover.
context: fork
---

# Exit gate

`scripts/claude/gate.mjs` runs the nine commands of the exit gate (docs/ROADMAP.md §3) and the criteria a script can check. Run it, find the first actionable error of each failure, and report. Report only: fixing is the caller's decision.

## Run

1. Record what the gate runs on: `git rev-parse --short HEAD`, the branch, and `git status --short`. The gate runs on the working tree, uncommitted changes included, but a merge carries only commits.
2. From the root of the checkout under test (a worktree runs its own), run `node scripts/claude/gate.mjs` with a Bash timeout of 600000 ms. It takes about four minutes: typecheck, lint, format:check, test and build-storybook in parallel, then build, verify-dist, check:package and test:pack in order.
   - `--base <ref>`: the merge base for the exception and docs checks (default `main`).
   - `--only <step,…>` / `--skip <step,…>`: a partial run, for re-checking a fixed step.
3. For each failed step, open its log (the path is in the table; the summary shows only the last 30 lines) and find the first actionable error: the file, line and message where the failure starts, not the last frames of a stack trace.

## Report

In this order:

1. **Verdict**: `PASSED` or `FAILED: <steps>`, with the commit and whether the tree had uncommitted changes.
2. The summary table, as printed.
3. One line per failed step: the first actionable error (`file:line message`) and the log path.
4. The criteria section, as printed (CHANGELOG top section, exceptions without a reason, act() and [WaveUI] warnings in the test output, documents changed).
5. The exit criteria of §3 that no script checks, each marked "not checked" for the caller: every item's acceptance criteria covered by tests; README (usage, keyboard and "Built-in text" tables), docs/WAVE-UI-GUIDE.md and CLAUDE.md updated; the ROADMAP status line and the phase spec's implementation notes; the phase spec's real-browser checklist (`/browser-check`).
