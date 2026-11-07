/**
 * The part of `scripts/verify-dist.mjs` the site calls. The script is plain JavaScript outside
 * the site's TypeScript program; this declaration types the one function the site imports.
 */
declare module '*/scripts/verify-dist.mjs' {
  /** Minified and gzip bytes of an import of `names` from `<dist>/index.mjs`, and its external ids. */
  export function measureImport(
    dist: string,
    names: readonly string[],
  ): Promise<{ minified: number; gzip: number; externals: string[] }>;
}
