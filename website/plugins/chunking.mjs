// @ts-check
/**
 * The client build's chunking and tree-shaking (website/BUDGET.md has the measurements behind each
 * choice). Rolldown's automatic chunking puts modules that the same set of islands import in one
 * chunk, which is right for the stories' code, but splits what every page loads into many small
 * chunks, and each chunk compresses alone: on the Button page the boundaries alone cost 7 KB
 * gzipped. So:
 *
 * - `react`: React, react-dom, the scheduler and Astro's React renderer, which every island page
 *   loads together.
 * - `base`: the static closure of the shell island and of the example runtime (`baseRoots`):
 *   the command bar's WaveUI components, the composer, `Example.tsx` and the library modules they
 *   import. Every page loads the shell; every component page loads the example runtime, so on a
 *   component page this chunk holds nothing it would not load anyway. The closure is computed
 *   from the client build's module graph when the build ends (the site's own modules import the
 *   library's modules directly, not its barrel, and `splitModules.mjs` points importers at the
 *   parts they use, so the walk reaches only what they import).
 * - Everything else keeps the automatic chunking: a wider group (all library code, or the popup
 *   stack) made other pages load code they do not use, which cost more than it saved.
 *
 * Tree-shaking treats calls of `warnOnce` and `devWarn` (`src/lib/dev.ts`) as pure: both return at
 * once in production, so a call whose result is unused is dropped with its message text.
 */

const REACT =
  /[\\/]node_modules[\\/](?:react|react-dom|scheduler)[\\/]|[\\/]node_modules[\\/]@astrojs[\\/]react[\\/]/;

/**
 * The library's development warnings. Treating their calls as pure is correct only because
 * `src/lib/dev.ts` returns from both at once when `process.env.NODE_ENV` is `'production'` (and
 * they return nothing); `chunking.test.ts` fails if that stops being true.
 */
export const PURE_FUNCTIONS = ['warnOnce', 'devWarn'];

/** A path with forward slashes, for comparing ids on Windows. */
const normalise = (/** @type {string} */ path) => path.replaceAll('\\', '/');

/**
 * The static-import closure of `roots` in a module graph. Throws when a root is not in the graph,
 * so a renamed root fails the build instead of leaving the group empty.
 *
 * @param {Iterable<string>} moduleIds every module id of the build
 * @param {(id: string) => { importedIds: readonly string[] } | null} getModuleInfo
 * @param {readonly string[]} roots absolute file paths
 */
export function staticClosure(moduleIds, getModuleInfo, roots) {
  const wanted = new Map(roots.map((root) => [normalise(root), root]));
  /** @type {Set<string>} */
  const closure = new Set();
  const visit = (/** @type {string} */ id) => {
    if (closure.has(id)) return;
    const info = getModuleInfo(id);
    if (!info) return;
    closure.add(id);
    for (const dependency of info.importedIds) visit(dependency);
  };
  for (const id of moduleIds) {
    const key = normalise(id.split('?')[0]);
    if (wanted.has(key)) {
      wanted.delete(key);
      visit(id);
    }
  }
  if (wanted.size > 0) {
    throw new Error(
      `The client build has no module ${[...wanted.values()].join(', ')} (website/plugins/chunking.mjs)`,
    );
  }
  return closure;
}

/**
 * @param {{ baseRoots: readonly string[] }} options absolute paths of the modules whose closure
 *   forms the `base` chunk
 * @returns {import('vite').Plugin}
 */
export function siteChunking({ baseRoots }) {
  /** @type {Set<string>} */
  let base = new Set();
  return {
    name: 'waveui-site-chunking',
    apply: 'build',
    configEnvironment(name) {
      if (name !== 'client') return undefined;
      return {
        build: {
          rolldownOptions: {
            treeshake: { manualPureFunctions: PURE_FUNCTIONS },
            output: {
              codeSplitting: {
                groups: [
                  { name: 'react', test: (id) => REACT.test(id), priority: 2 },
                  { name: 'base', test: (id) => base.has(id), priority: 1 },
                ],
              },
            },
          },
        },
      };
    },
    buildEnd() {
      if (this.environment.name !== 'client') return;
      base = staticClosure(this.getModuleIds(), (id) => this.getModuleInfo(id), baseRoots);
    },
  };
}
