/**
 * The example island on the server, in Node as Astro's build renders it (no `window`, no
 * `document`): the static preview, the guard around the whole render, and the build-time
 * detection of the stories that open a modal as soon as they render. The browser half of the
 * island is tested in example.test.tsx.
 */
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as buttonStories from '../../../stories/Button.stories';
import * as dialogStories from '../../../stories/Dialog.stories';
import * as switchStories from '../../../stories/Switch.stories';
import { getCatalog } from '../catalog/catalog';
import { analyzeExample, analyzeStory, opensModal } from '../examples/analysis';
import { composeStoryExport, type StoryModule } from '../stories/runtime';
import * as fixtureStories from './__fixtures__/example.stories';
import { createExampleIsland } from './Example';

const FIXTURE_FILE = 'website/src/islands/__fixtures__/example.stories.tsx';
const FixtureIsland = createExampleIsland(FIXTURE_FILE, fixtureStories as StoryModule);
const ButtonIsland = createExampleIsland(
  'stories/Button.stories.tsx',
  buttonStories as StoryModule,
);
const SwitchIsland = createExampleIsland(
  'stories/Switch.stories.tsx',
  switchStories as StoryModule,
);
const DialogIsland = createExampleIsland(
  'stories/Dialog.stories.tsx',
  dialogStories as StoryModule,
);

/**
 * The preview element of the island's markup with its content: the opening tag, then the story's
 * markup and nothing else up to the closing tag (the story's markup is passed in, so the end is
 * known).
 */
function previewOf(html: string, storyHtml: string): string {
  const open = /<div[^>]*data-example-preview=""[^>]*>/.exec(html);
  if (!open) throw new Error(`no preview element in ${html}`);
  return html.slice(open.index, open.index + open[0].length + storyHtml.length + '</div>'.length);
}

function expectPreview(html: string, storyHtml: string): void {
  const open = /<div[^>]*data-example-preview=""[^>]*>/.exec(html)![0];
  expect(previewOf(html, storyHtml)).toBe(`${open}${storyHtml}</div>`);
}

/** React's `useId` ids depend on the tree position; the comparison ignores them. */
const normaliseIds = (html: string) => html.replace(/_r_[0-9a-z]+_/gi, '_r_id_');

describe('the static preview', () => {
  it('server render equals the story with default args', () => {
    const button = composeStoryExport(
      'stories/Button.stories.tsx',
      buttonStories as StoryModule,
      'Default',
    );
    const html = renderToString(<ButtonIsland slug="button" storyName="Default" />);
    expectPreview(html, renderToString(<button.Component />));

    // A story with ids (the switch's label and control).
    const disabled = composeStoryExport(
      'stories/Switch.stories.tsx',
      switchStories as StoryModule,
      'Disabled',
    );
    const switchHtml = normaliseIds(
      renderToString(<SwitchIsland slug="switch" storyName="Disabled" />),
    );
    expectPreview(switchHtml, normaliseIds(renderToString(<disabled.Component />)));
    // The controls are not in the static page: the toggle is, disabled until the island runs.
    expect(switchHtml).not.toContain('<fieldset');
    expect(switchHtml).toMatch(/<button[^>]*aria-expanded="false"[^>]*disabled=""[^>]*>/);
  });

  it('analyzes a plain story as an inline example without a server error', () => {
    expect(
      analyzeStory(
        composeStoryExport('stories/Button.stories.tsx', buttonStories as StoryModule, 'Default'),
      ),
    ).toEqual({
      mode: 'inline',
    });
  });
});

describe('the guard around the whole render', () => {
  it('a story that throws during render shows a clear error panel naming the story, not a blank page (server)', () => {
    for (const [storyName, message] of [
      ['Throws', 'Broken on purpose'],
      ['LibraryThrows', 'Rating.Item must be used within a rating'],
    ] as const) {
      const analysis = analyzeStory(
        composeStoryExport(FIXTURE_FILE, fixtureStories as StoryModule, storyName),
      );
      expect(analysis.mode).toBe('inline');
      expect(analysis.serverError).toContain(message);

      const html = renderToString(
        <FixtureIsland slug="fixture" storyName={storyName} {...analysis} />,
      );
      expect(html).toContain('data-example-error=""');
      expect(html).toContain(`fixture › ${storyName}`);
      expect(html).toContain(message);
    }
  });

  it('a story reading window during render does not crash the server render', () => {
    expect(typeof window).toBe('undefined');
    const story = composeStoryExport(FIXTURE_FILE, fixtureStories as StoryModule, 'ReadsWindow');
    const analysis = analyzeStory(story);
    expect(analysis.serverError).toContain('window is not defined');

    let html = '';
    expect(() => {
      html = renderToString(<FixtureIsland slug="fixture" storyName="ReadsWindow" {...analysis} />);
    }).not.toThrow();
    expect(html).toContain('fixture › ReadsWindow');
  });

  it('an unknown story names itself in the panel instead of failing the page', async () => {
    const analysis = await analyzeExample('button', 'NoSuchStory');
    expect(analysis.serverError).toContain('stories/Button.stories.tsx#NoSuchStory');
    const html = renderToString(
      <ButtonIsland slug="button" storyName="NoSuchStory" {...analysis} />,
    );
    expect(html).toContain('button › NoSuchStory');
    await expect(analyzeExample('no-such-component', 'Default')).rejects.toThrow(
      'no-such-component',
    );
  });
});

describe('stories that open a modal', () => {
  it('opensModal reads a dialog in the server HTML, or the docs iframe hint', () => {
    expect(opensModal('<div role="dialog" aria-label="x"></div>', {})).toBe(true);
    expect(opensModal('<div role="alertdialog"></div>', {})).toBe(true);
    expect(opensModal('<div aria-modal="true"></div>', {})).toBe(true);
    expect(opensModal('<div></div>', { docs: { story: { inline: false } } })).toBe(true);
    expect(opensModal('<div role="dialogue"></div>', { docs: { story: { inline: true } } })).toBe(
      false,
    );
    expect(opensModal('<button>Open dialog</button>', {})).toBe(false);
  });

  it('a modal story is detected and shows no static preview (server)', async () => {
    const analysis = await analyzeExample('dialog', 'Open');
    expect(analysis).toEqual({ mode: 'on-demand' });
    const html = renderToString(<DialogIsland slug="dialog" storyName="Open" {...analysis} />);
    expect(html).not.toContain('wave-root');
    expect(html).toContain('This example opens a dialog or panel. Use the button to show it.');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Show example/);
  });

  it('the set of detected modal stories across the catalog equals the expected list', async () => {
    const skipped = (
      JSON.parse(readFileSync(new URL('../../skipped-stories.json', import.meta.url), 'utf8')) as {
        story: string;
      }[]
    ).map((item) => item.story);
    const detected: string[] = [];
    const serverErrors: string[] = [];
    for (const entry of getCatalog()) {
      for (const storyName of entry.storyNames) {
        if (skipped.includes(`${entry.storyFile}#${storyName}`)) continue;
        const analysis = await analyzeExample(entry.slug, storyName);
        if (analysis.mode === 'on-demand') detected.push(`${entry.slug}#${storyName}`);
        if (analysis.serverError) serverErrors.push(`${entry.slug}#${storyName}`);
      }
    }

    expect(serverErrors).toEqual([]);
    // A change to this list is a conscious one: each of these opens a dialog, a drawer or a modal
    // layer as soon as it renders (or Storybook's docs show it in an iframe for that reason).
    expect([...detected].sort()).toEqual([...EXPECTED_MODAL_STORIES].sort());
    expect(detected).toHaveLength(27);
  }, 240_000);
});

const EXPECTED_MODAL_STORIES = [
  // Rendered in place with `role="dialog"`: the steps form without a target is an inline,
  // non-modal surface, but it takes focus as it shows (and scrolls to it), which would pull the
  // reader to the example as it hydrates.
  'teaching-popover#Appearances',
  'teaching-popover#Default',
  'teaching-popover#FooterActions',
  'teaching-popover#LastStep',
  'teaching-popover#SecondStep',
  'teaching-popover#SingleStep',
  'teaching-popover#VerticalFooter',
  // `docs.story.inline: false`: a dialog, drawer or popup opens as the story mounts (portaled, so
  // the server markup has none of it).
  'custom-overlays#PopupOnPublicHooks',
  'custom-overlays#FlipAndHideWhenDetached',
  'custom-overlays#FitViewportPopover',
  'custom-overlays#PaletteOverDialog',
  'custom-overlays#GridRoving',
  'custom-overlays#FocusableGroupRows',
  'custom-overlays#KeyboardMode',
  'date-picker#MonthAndYearPicker',
  'date-picker#WeekNumbers',
  'date-picker#CloseButton',
  'dialog#Open',
  'dialog#NarrowViewport',
  'dialog#LargeAndFullScreen',
  'dialog#LongContent',
  'dialog#NonModal',
  'dialog#FullScreen',
  'drawer#HeaderAndFooter',
  'drawer#NonModal',
  'wave-provider#NestedAccentWithADialog',
  'wave-provider#PortalsWithoutStyles',
];
