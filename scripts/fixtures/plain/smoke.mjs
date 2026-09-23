/**
 * ESM consumer of the packed tarball (run by scripts/pack-smoke.mjs inside an installed copy of
 * this fixture). Imports the package, calls `cn`, resolves every exported subpath through the
 * package's `exports` map and prints what it observed as JSON; pack-smoke asserts it.
 *
 * Usage: node smoke.mjs '<JSON array of subpaths, e.g. ["./styles"]>'
 */
import { fileURLToPath } from 'node:url';

const name = '@mortenbrudvik/waveui';
const subpaths = JSON.parse(process.argv[2] ?? '[]');
const result = { resolved: {} };

try {
  const mod = await import(name);
  result.names = Object.keys(mod).sort();
  result.cn = mod.cn('a', false, 'b');
} catch (error) {
  result.error = String(error && error.message ? error.message : error);
}

for (const subpath of subpaths) {
  try {
    result.resolved[subpath] = fileURLToPath(import.meta.resolve(`${name}${subpath.slice(1)}`));
  } catch {
    result.resolved[subpath] = null;
  }
}

console.log(JSON.stringify(result));
