/**
 * The story runtime renders the library's own stories in Node, as Astro's server render does (no
 * `window`, no `document`). Storybook's `composeStory` appears only here, as the oracle the site
 * composer is checked against; the site's own code never imports it.
 */
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { composeStory } from '@storybook/react';
import { fn as aliasedFn } from 'storybook/test';
import { beforeAll, describe, expect, it } from 'vitest';
import { getCatalog, type ComponentEntry } from '../catalog/catalog';
import {
  composeStoryExport,
  createStoryLoader,
  getStoryFiles,
  loadStory,
  projectAnnotations,
  SiteChoiceContext,
  StoryError,
  type StoryModule,
} from './runtime';
import { fn as shimFn } from './storybook-test-shim';

const catalog = getCatalog();

function entryFor(slug: string): ComponentEntry {
  const entry = catalog.find((candidate) => candidate.slug === slug);
  if (!entry) throw new Error(`no catalog entry "${slug}"`);
  return entry;
}

interface SkippedStory {
  story: string;
  reason: string;
}

const skipped = JSON.parse(
  readFileSync(new URL('../../skipped-stories.json', import.meta.url), 'utf8'),
) as SkippedStory[];

/** The ids of the modules this test file has evaluated (Vitest's module graph for the file). */
function evaluatedModuleIds(): string[] {
  const worker = (
    globalThis as {
      __vitest_worker__?: { evaluatedModules?: { idToModuleMap?: Map<string, unknown> } };
    }
  ).__vitest_worker__;
  const map = worker?.evaluatedModules?.idToModuleMap;
  if (!map) throw new Error('Vitest no longer exposes its module graph here: update this helper');
  return [...map.keys()].map((id) => id.replaceAll('\\', '/'));
}

// The stories import the library's barrel, whose first evaluation takes seconds; the runtime itself
// imports only the modules it uses, so the first story loaded would pay it inside its test.
beforeAll(async () => {
  await import('../../../src');
}, 60_000);

describe('loadStory', () => {
  it('renders the Button Default story to a button element on the server', async () => {
    const story = await loadStory(entryFor('button'), 'Default');
    const html = renderToString(<story.Component />);

    expect(html).toMatch(/^<div[^>]*class="[^"]*\bwave-root\b[^"]*\bwave-light\b/);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>(?:(?!<\/button>).)*Button<\/button>/);
    expect(story.name).toBe('Default');
    expect(story.args.children).toBe('Button');
  });

  it('gives the props of Component precedence over the story args', async () => {
    const story = await loadStory(entryFor('button'), 'Default');
    const html = renderToString(<story.Component children="Changed" />);

    expect(html).toContain('Changed</button>');
    expect(html).not.toContain('>Button</button>');
  });

  it('the WaveProvider decorator takes the theme and dir of SiteChoiceContext', async () => {
    const story = await loadStory(entryFor('button'), 'Default');
    const html = renderToString(
      <SiteChoiceContext value={{ theme: 'dark', dir: 'rtl' }}>
        <story.Component />
      </SiteChoiceContext>,
    );

    expect(html).toMatch(/^<div[^>]*class="[^"]*\bwave-dark\b/);
    expect(html).toMatch(/^<div[^>]*dir="rtl"/);
  });

  it('names a story by its name annotation, else by its export in start case', async () => {
    const calendar = entryFor('calendar');
    expect((await loadStory(calendar, 'WeekNumbersISO')).name).toBe('Week numbers (ISO)');
    expect((await loadStory(entryFor('button'), 'WithIcon')).name).toBe('With Icon');
    expect((await loadStory(entryFor('button'), 'IconOnly')).name).toBe('Icon Only');
  });

  it('merges the args and argTypes of the meta and the story, the story winning', async () => {
    const story = await loadStory(entryFor('button'), 'Sizes');

    expect(typeof story.args.onClick).toBe('function');
    // The story turns the size control off; the options of the meta's argType stay.
    expect(story.argTypes.size).toEqual({
      control: false,
      options: ['extra-small', 'small', 'medium', 'large', 'extra-large'],
    });
    expect(story.argTypes.appearance).toMatchObject({ control: 'select' });
  });

  it('rejects an unknown story with an error that names it', async () => {
    const button = entryFor('button');
    await expect(loadStory(button, 'NoSuchStory')).rejects.toThrow(StoryError);
    await expect(loadStory(button, 'NoSuchStory')).rejects.toThrow(
      'stories/Button.stories.tsx#NoSuchStory',
    );
    await expect(
      loadStory({ ...button, storyFile: 'stories/Missing.stories.tsx' }, 'Default'),
    ).rejects.toThrow('stories/Missing.stories.tsx#Default');
  });

  it('can load the story file of every catalog entry and of nothing else', () => {
    expect(getStoryFiles().sort()).toEqual(catalog.map((entry) => entry.storyFile).sort());
  });

  it('composes a story of a module imported statically', async () => {
    const module = await import('../../../stories/Button.stories');
    const story = composeStoryExport('stories/Button.stories.tsx', module, 'Primary');

    expect(story.name).toBe('Primary');
    expect(renderToString(<story.Component />)).toContain('Primary</button>');
    expect(() => composeStoryExport('stories/Button.stories.tsx', module, 'default')).toThrow(
      'stories/Button.stories.tsx#default',
    );
  });
});

describe('the site composer against composeStory', () => {
  const storyModules = import.meta.glob<StoryModule>('../../../stories/*.stories.tsx');

  it.each([
    ['button', 'Default', 'args only'],
    ['button', 'Sizes', 'a render function'],
    ['button', 'DisabledFocusable', 'a render function with a Tooltip (useId)'],
    ['divider', 'Default', 'a story decorator'],
    ['menu', 'InlineWithDetails', 'a story decorator around a menu'],
  ])('%s %s (%s) renders the same markup on the server', async (slug, exportName) => {
    const entry = entryFor(slug);
    const site = await loadStory(entry, exportName);
    const importModule = storyModules[`../../../${entry.storyFile}`];
    if (!importModule) throw new Error(`no story module ${entry.storyFile}`);
    const module = await importModule();
    const Oracle = composeStory(
      module[exportName] as never,
      module.default as never,
      projectAnnotations as never,
      exportName,
    );

    expect(renderToString(<site.Component />)).toBe(renderToString(<Oracle />));
  });
});

describe('server rendering of every story', () => {
  it('every story of every catalog entry renders on the server or is listed in skipped-stories.json', async () => {
    const failures: { story: string; error: string }[] = [];
    const outsideProvider: string[] = [];
    for (const entry of catalog) {
      for (const storyName of entry.storyNames) {
        const id = `${entry.storyFile}#${storyName}`;
        let html: string;
        try {
          const story = await loadStory(entry, storyName);
          html = renderToString(<story.Component />);
        } catch (error) {
          failures.push({
            story: id,
            error: error instanceof Error ? error.message : String(error),
          });
          continue;
        }
        // React hoists an image's preload `<link>` in front of the markup (Astro drops it).
        if (!/^(?:<link[^>]*>)*<div[^>]*class="[^"]*\bwave-root\b/.test(html)) {
          outsideProvider.push(id);
        }
      }
    }

    // Every story that rendered went through the project decorator.
    expect(outsideProvider).toEqual([]);
    const listed = skipped.map((item) => item.story).sort();
    const failed = failures.map((failure) => failure.story).sort();
    const unlisted = failures.filter((failure) => !listed.includes(failure.story));
    expect(
      failed,
      `unlisted failures:\n${unlisted.map((f) => `${f.story}: ${f.error}`).join('\n')}`,
    ).toEqual(listed);
  }, 180_000);

  it('lists each skipped story once, with a reason', () => {
    const ids = skipped.map((item) => item.story);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of skipped) {
      expect(item.story).toMatch(/^stories\/[^#]+\.stories\.tsx#\w+$/);
      expect(item.reason.trim().length).toBeGreaterThan(20);
    }
  });

  it('a story that reads window during render does not crash the loader', async () => {
    const file = 'website/src/stories/__fixtures__/window.stories.tsx';
    const load = createStoryLoader({
      [file]: () => import('./__fixtures__/window.stories') as Promise<StoryModule>,
    });

    const reads = await load({ storyFile: file }, 'ReadsWindow');
    let thrown: unknown;
    try {
      renderToString(<reads.Component />);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(StoryError);
    const error = thrown as StoryError;
    expect(error.story).toBe(`${file}#ReadsWindow`);
    expect(error.message).toContain(`${file}#ReadsWindow`);
    expect(error.cause).toBeInstanceOf(ReferenceError);

    // The same loader goes on to render the module's other story.
    const plain = await load({ storyFile: file }, 'Plain');
    expect(renderToString(<plain.Component />)).toContain('Plain</button>');
  });
});

describe('storybook/test', () => {
  it('the storybook/test shim is what stories import', async () => {
    expect(aliasedFn).toBe(shimFn);

    const story = await loadStory(entryFor('button'), 'Default');
    // A real `fn()` is a spy that records calls; the shim's action is a plain no-op.
    expect(story.args.onClick).toBeTypeOf('function');
    expect(story.args.onClick).not.toHaveProperty('mock');

    const ids = evaluatedModuleIds();
    expect(ids.some((id) => id.endsWith('/stories/Button.stories.tsx'))).toBe(true);
    expect(ids.some((id) => id.endsWith('/website/src/stories/storybook-test-shim.ts'))).toBe(true);
    expect(
      ids.filter((id) => /\/node_modules\/(?:storybook\/dist\/test|@testing-library)\//.test(id)),
    ).toEqual([]);
  });
});
