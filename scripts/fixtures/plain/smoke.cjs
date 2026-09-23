/**
 * CommonJS consumer of the packed tarball (run by scripts/pack-smoke.mjs inside an installed copy
 * of this fixture). Requires the package, calls `cn`, resolves every exported subpath through
 * the `require` condition of the package's `exports` map and prints what it observed as JSON.
 *
 * Usage: node smoke.cjs '<JSON array of subpaths, e.g. ["./styles"]>'
 */
const name = '@mortenbrudvik/waveui';
const subpaths = JSON.parse(process.argv[2] ?? '[]');
const result = { resolved: {} };

try {
  const mod = require(name);
  result.names = Object.keys(mod)
    .filter((key) => key !== '__esModule')
    .sort();
  result.cn = mod.cn('a', false, 'b');
} catch (error) {
  result.error = String(error && error.message ? error.message : error);
}

for (const subpath of subpaths) {
  try {
    result.resolved[subpath] = require.resolve(`${name}${subpath.slice(1)}`);
  } catch {
    result.resolved[subpath] = null;
  }
}

console.log(JSON.stringify(result));
