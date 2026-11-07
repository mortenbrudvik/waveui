#!/usr/bin/env node
// `npm run site:check`: the gates of the built site (website/dist), each in a process of its own so
// that a failure of the first does not hide the second: the budget and base-path gate
// (check-budget.mjs) and the skipped-stories gate (check-skipped.mjs). Exit code 1 when either
// fails; with no build, each says to run `npm run site:build` first.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let failed = false;
for (const script of ['check-budget.mjs', 'check-skipped.mjs']) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], {
    stdio: 'inherit',
  });
  if (result.error) console.error(result.error);
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
