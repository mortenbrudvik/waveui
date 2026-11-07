/**
 * The search palette's index, pre-rendered to `/waveui/docs/_assets/search-index.json` (Astro
 * skips page files under a folder whose name starts with `_`, so the folder is a parameter with the
 * one value `_assets`). Built in the same process as the pages, so it reuses their parsed docs.
 * `src/search/searchIndex.ts` says what it holds.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { readSearchIndex, serialiseSearchIndex } from '../../search/searchIndex';

export const getStaticPaths = (() => [{ params: { assets: '_assets' } }]) satisfies GetStaticPaths;

export const GET: APIRoute = () =>
  new Response(serialiseSearchIndex(readSearchIndex()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
