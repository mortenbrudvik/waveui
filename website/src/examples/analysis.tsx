/**
 * What the build knows about an example before the page is written (server code: `Example.astro`
 * calls it; it is never sent to the browser). It renders the story with its default args, as the
 * static preview does, inside a `try` around the whole render, and reads the result:
 *
 * - `serverError`: the message of anything the render threw, the story's own errors (named by the
 *   story runtime) and the library's alike, so the island shows a panel naming the story instead
 *   of failing the build (a story that reads `window` then renders in the browser);
 * - `mode: 'on-demand'` for a story that opens a modal as it renders ({@link opensModal}), which
 *   the island mounts only when the reader asks, so the page is not trapped or scroll-locked on
 *   load.
 */
import { renderToString } from 'react-dom/server';
import { getCatalog, type ComponentEntry } from '../catalog/catalog';
import type { ExampleMode } from '../islands/Example';
import { loadStory, type ComposedStory } from '../stories/runtime';

export interface ExampleAnalysis {
  mode: ExampleMode;
  serverError?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Whether a story opens a modal as it renders, from its server markup and its parameters:
 *
 * - the markup holds an element with `role="dialog"` or `role="alertdialog"`, or
 *   `aria-modal="true"` (a dialog or drawer rendered in place);
 * - or `parameters.docs.story.inline === false`: Storybook's docs show the story in an iframe of
 *   its own, which the library's stories do exactly for those that open a dialog, a drawer or a
 *   modal layer as they mount. A portaled dialog renders only in the browser (the library's
 *   `Portal` renders nothing on the server), so its server markup cannot show it; this hint does.
 */
export function opensModal(html: string, parameters: Record<string, unknown>): boolean {
  if (/\brole="(?:alert)?dialog"/.test(html) || /\baria-modal="true"/.test(html)) return true;
  const docs = parameters.docs;
  const story = isRecord(docs) ? docs.story : undefined;
  return isRecord(story) && story.inline === false;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Renders a composed story on the server, as the static preview does, and reads the markup. */
export function analyzeStory(story: ComposedStory): ExampleAnalysis {
  let html: string;
  try {
    html = renderToString(<story.Component />);
  } catch (error) {
    return { mode: 'inline', serverError: messageOf(error) };
  }
  return { mode: opensModal(html, story.parameters) ? 'on-demand' : 'inline' };
}

let catalog: ComponentEntry[] | undefined;

/**
 * The analysis of the story `storyName` of the catalog entry `slug`. An unknown slug throws (a
 * page that names no component is a bug of the page); a story that cannot be loaded or composed
 * is a `serverError`, so the page still builds and the island shows the panel.
 */
export async function analyzeExample(slug: string, storyName: string): Promise<ExampleAnalysis> {
  catalog ??= getCatalog();
  const entry = catalog.find((candidate) => candidate.slug === slug);
  if (!entry) throw new Error(`No catalog entry has the slug "${slug}"`);
  let story: ComposedStory;
  try {
    story = await loadStory(entry, storyName);
  } catch (error) {
    return { mode: 'inline', serverError: messageOf(error) };
  }
  return analyzeStory(story);
}
