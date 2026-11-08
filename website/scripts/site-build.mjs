// `npm run site:build`: the site reads the library's built `dist` (its sheets and the import-size
// facts), so the library is built first when `dist/index.mjs` is absent, then the site.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Run the npm that started this script (its CLI file, under the same Node.js), with no shell and
// no `.cmd` shim, so it works the same on Windows and Linux.
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error('site:build: run it through npm (npm run site:build)');
  process.exit(1);
}

function run(args) {
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd: root, stdio: 'inherit' });
  // A spawn that fails itself (no status) says why only in `result.error`.
  if (result.error) console.error(result.error);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(new URL('../../dist/index.mjs', import.meta.url))) {
  console.log('site:build: dist/index.mjs is absent, building the library first');
  run(['run', 'build']);
}
run(['run', 'build', '-w', 'website']);
