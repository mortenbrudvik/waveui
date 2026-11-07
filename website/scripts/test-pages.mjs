// `npm run site:test:pages`: builds the site (`npm run site:build`, which builds the library first
// when its dist is absent), then runs the tests of the built pages (the `pages` Vitest project) with
// WAVEUI_REQUIRE_PAGES set, so a missing or stale build fails them instead of skipping them
// (website/test/builtSite.ts).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error('site:test:pages: run it through npm (npm run site:test:pages)');
  process.exit(1);
}

function run(args, env = process.env) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    stdio: 'inherit',
    env,
  });
  if (result.error) console.error(result.error);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(['run', 'site:build']);
run(['test', '-w', 'website', '--', '--project', 'pages'], {
  ...process.env,
  WAVEUI_REQUIRE_PAGES: '1',
});
