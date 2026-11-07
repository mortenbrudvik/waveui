/**
 * The example island in the browser: its server markup (rendered as Astro renders an island, with
 * the island's id prefix) is put into jsdom with no script run, then hydrated as Astro's React
 * renderer does when the example scrolls into view. Every hydration must match: no recoverable
 * error and no `console.error` (attribute mismatches reach only the console).
 *
 * The suite runs in the `dom` Vitest project (vitest.config.ts): jsdom with the SSR transform, so
 * `Example.astro` renders through Astro's container API in the same file.
 */
import * as React from 'react';
import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import * as buttonStories from '../../../stories/Button.stories';
import * as dialogStories from '../../../stories/Dialog.stories';
import * as switchStories from '../../../stories/Switch.stories';
import { analyzeExample, analyzeStory } from '../examples/analysis';
import { CHOICE_EVENT } from '../shell/events';
import { composeStoryExport, type StoryModule } from '../stories/runtime';
import * as fixtureStories from './__fixtures__/example.stories';
import { controlsChunk, createExampleIsland, type ExampleIslandProps } from './Example';
import ExampleAstro from './Example.astro';

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

type Island = React.ComponentType<ExampleIslandProps>;

let root: Root | undefined;
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  // Silenced, and every call asserted: afterEach fails on any a test did not expect.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  // Whatever a test did, nothing it did logged an error it did not assert.
  expect(consoleError).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  for (const element of [document.documentElement, document.body]) {
    for (const { name } of [...element.attributes]) element.removeAttribute(name);
  }
  document.body.innerHTML = '';
});

/** The island's server markup in a page with no script run, then hydrated onto it. */
async function serve(Component: Island, props: ExampleIslandProps, prefix = 'r1') {
  const html = renderToString(<Component {...props} />, { identifierPrefix: prefix });
  document.documentElement.lang = 'en';
  document.title = 'Example';
  document.body.innerHTML = `<main><astro-island prefix="${prefix}">${html}</astro-island></main>`;
  const island = document.querySelector('astro-island')!;
  const recoverable: unknown[] = [];
  await act(async () => {
    root = hydrateRoot(island, <Component {...props} />, {
      identifierPrefix: prefix,
      onRecoverableError: (error) => recoverable.push(error),
    });
  });
  expect(recoverable).toEqual([]);
  return { html, island: island as HTMLElement };
}

const example = (name: string) => screen.getByRole('group', { name: `Example: ${name}` });

/** The WaveProvider root the story renders in. */
const providerRoot = () =>
  document.querySelector<HTMLElement>('[data-example-preview] > .wave-root');

function expectNoOverlayState(): void {
  for (const element of [document.documentElement, document.body]) {
    expect(element.style.overflow).toBe('');
    expect(element.style.paddingInlineEnd).toBe('');
    expect(element.style.paddingRight).toBe('');
  }
  expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  expect(
    document.querySelectorAll('[aria-hidden="true"]:not(svg, [data-example-preview] *)'),
  ).toHaveLength(0);
  // Only the page is left: no portal of the story.
  expect([...document.body.children].map((child) => child.tagName)).toEqual(['MAIN']);
}

/** Loads the controls chunk and waits until its module has settled. */
async function openControls(user: ReturnType<typeof userEvent.setup>, name: string) {
  const load = vi.spyOn(controlsChunk, 'load');
  await user.click(within(example(name)).getByRole('button', { name: 'Controls' }));
  await act(async () => {
    await load.mock.results[0]?.value;
  });
  return within(example(name)).getByRole('group', { name: 'Props' });
}

describe('hydration', () => {
  it('hydrates every kind of example without a mismatch or a console error', async () => {
    for (const [Component, props] of [
      [ButtonIsland, { slug: 'button', storyName: 'Default' }],
      [SwitchIsland, { slug: 'switch', storyName: 'Disabled' }],
      [DialogIsland, { slug: 'dialog', storyName: 'Open', mode: 'on-demand' }],
      [
        FixtureIsland,
        { slug: 'fixture', storyName: 'ReadsWindow', serverError: 'window is not defined' },
      ],
    ] as const) {
      // The page's inline script set a dark, right-to-left choice before the island hydrates.
      document.documentElement.className = 'wave-dark';
      document.documentElement.dir = 'rtl';
      await serve(Component, props);
      act(() => root?.unmount());
      root = undefined;
    }
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe('the controls', () => {
  it('the controls chunk is not requested until the example is focused or hovered', async () => {
    const load = vi.spyOn(controlsChunk, 'load');
    const user = userEvent.setup();

    await serve(SwitchIsland, { slug: 'switch', storyName: 'Disabled' });
    await act(async () => {});
    expect(load).not.toHaveBeenCalled();

    await user.hover(example('Disabled'));
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      await load.mock.results[0]!.value;
    });
    await user.unhover(example('Disabled'));
    await user.hover(example('Disabled'));
    expect(load).toHaveBeenCalledTimes(1);
    act(() => root?.unmount());
    root = undefined;

    // Focus moving into the example requests it too.
    load.mockClear();
    await serve(SwitchIsland, { slug: 'switch', storyName: 'Disabled' });
    expect(load).not.toHaveBeenCalled();
    act(() => within(example('Disabled')).getByRole('button', { name: 'Controls' }).focus());
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      await load.mock.results[0]!.value;
    });
  });

  it('a story without a supported control has no Controls and loads no chunk', async () => {
    const load = vi.spyOn(controlsChunk, 'load');
    const user = userEvent.setup();
    // Its one arg is a function.
    await serve(FixtureIsland, { slug: 'fixture', storyName: 'NoControls' });
    const group = example('No Controls');
    await user.hover(group);
    act(() => within(group).getByRole('button', { name: 'No controls' }).focus());
    expect(within(group).queryByRole('button', { name: 'Controls' })).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('toggling a boolean control re-renders with the new arg', async () => {
    const user = userEvent.setup();
    await serve(SwitchIsland, { slug: 'switch', storyName: 'Disabled' });
    const toggle = within(example('Disabled')).getByRole('button', { name: 'Controls' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    const panel = await openControls(user, 'Disabled');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const control = within(panel).getByRole<HTMLInputElement>('checkbox', { name: 'disabled' });
    const story = () =>
      within(providerRoot()!).getByRole<HTMLInputElement>('switch', { name: 'Disabled switch' });
    expect(control.checked).toBe(true);
    expect(story().disabled).toBe(true);

    await user.click(control);
    expect(control.checked).toBe(false);
    expect(story().disabled).toBe(false);

    // The text control changes the label the same way.
    const label = within(panel).getByRole<HTMLInputElement>('textbox', { name: 'label' });
    await user.clear(label);
    await user.type(label, 'Wi-Fi');
    expect(within(providerRoot()!).getByRole('switch', { name: 'Wi-Fi' })).not.toBeNull();

    // Closing the panel keeps the args.
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(providerRoot()!).getByRole('switch', { name: 'Wi-Fi' })).not.toBeNull();
  });

  it('a select control offers exactly the argTypes options', async () => {
    const user = userEvent.setup();
    const primary = composeStoryExport(
      'stories/Button.stories.tsx',
      buttonStories as StoryModule,
      'Primary',
    );
    await serve(ButtonIsland, { slug: 'button', storyName: 'Primary' });
    const panel = await openControls(user, 'Primary');

    const select = within(panel).getByRole<HTMLSelectElement>('combobox', { name: 'appearance' });
    const expected = (primary.argTypes.appearance as { options: string[] }).options;
    expect([...select.options].map((option) => option.value)).toEqual(expected);
    expect(select.value).toBe('primary');

    // The button's classes are those of the story rendered with the same args.
    const button = () => within(providerRoot()!).getByRole('button', { name: 'Primary' });
    const classesWith = (args: Record<string, unknown>) =>
      new DOMParser()
        .parseFromString(renderToString(<primary.Component {...args} />), 'text/html')
        .querySelector('button')!.className;
    expect(button().className).toBe(classesWith({}));
    await user.selectOptions(select, 'outline');
    expect(button().className).toBe(classesWith({ appearance: 'outline' }));
    expect(button().className).not.toBe(classesWith({}));

    // An arg with options but no value yet offers "Not set" before them, and keeps it.
    const size = within(panel).getByRole<HTMLSelectElement>('combobox', { name: 'size' });
    const sizes = (primary.argTypes.size as { options: string[] }).options;
    expect([...size.options].map((option) => option.value)).toEqual(['', ...sizes]);
    expect(size.options[0]!.textContent).toBe('Not set');
    await user.selectOptions(size, 'large');
    expect(button().className).toBe(classesWith({ appearance: 'outline', size: 'large' }));
    await user.selectOptions(size, '');
    expect([...size.options].map((option) => option.value)).toEqual(['', ...sizes]);
    expect(button().className).toBe(classesWith({ appearance: 'outline' }));
  });

  it('controls never show a function arg (fn())', async () => {
    const user = userEvent.setup();
    const disabled = composeStoryExport(
      'stories/Switch.stories.tsx',
      switchStories as StoryModule,
      'Disabled',
    );
    expect(typeof disabled.args.onCheckedChange).toBe('function');

    await serve(SwitchIsland, { slug: 'switch', storyName: 'Disabled' });
    const panel = await openControls(user, 'Disabled');
    const names = [...panel.querySelectorAll('label')].map((label) => label.textContent);
    expect(names).toEqual(['label', 'disabled']);

    // Nor a React node: WithIcon's `icon` is an element; its `children` is text.
    act(() => root?.unmount());
    root = undefined;
    await serve(ButtonIsland, { slug: 'button', storyName: 'WithIcon' });
    const iconPanel = await openControls(user, 'With Icon');
    const iconNames = [...iconPanel.querySelectorAll('label')].map((label) => label.textContent);
    expect(iconNames).not.toContain('icon');
    expect(iconNames).not.toContain('onClick');
    expect(iconNames).toContain('children');
  });
});

describe('errors', () => {
  it('a story that throws during render shows a clear error panel naming the story, not a blank page (client)', async () => {
    const analysis = analyzeStory(
      composeStoryExport(FIXTURE_FILE, fixtureStories as StoryModule, 'Throws'),
    );
    expect(analysis.serverError).toContain('Broken on purpose');

    const { html } = await serve(FixtureIsland, {
      slug: 'fixture',
      storyName: 'Throws',
      ...analysis,
    });
    // The server's panel, then the browser's: it tried the story once more and it threw again.
    expect(html).toContain('could not be rendered on the server');
    const panel = document.querySelector<HTMLElement>('[data-example-error]')!;
    expect(panel.textContent).toContain('fixture › Throws');
    expect(panel.textContent).toContain('failed to render');
    expect(panel.textContent).toContain('Broken on purpose');
    // React reports the error the boundary caught, once.
    const calls = consoleError.mock.calls;
    consoleError.mockClear();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([
      '%o\n\n%s\n\n%s\n',
      expect.objectContaining({
        name: 'StoryError',
        message: `Story "${FIXTURE_FILE}#Throws" failed to render: Broken on purpose`,
      }),
      'The above error occurred in the <StoryRender> component.',
      'React will try to recreate this component tree from scratch using the error boundary you provided, StoryBoundary.',
    ]);
  });

  it('a story reading window during render is guarded: the server panel, then the story in the browser', async () => {
    const { html } = await serve(FixtureIsland, {
      slug: 'fixture',
      storyName: 'ReadsWindow',
      serverError: 'Story "x" failed to render: window is not defined',
    });
    expect(html).toContain('fixture › ReadsWindow');
    expect(document.querySelector('[data-example-error]')).toBeNull();
    expect(within(providerRoot()!).getByRole('button').textContent).toMatch(
      /^Viewport \d+px wide$/,
    );
  });
});

describe('stories that open a modal', () => {
  it('a modal story is detected, shows no static preview, and its Show example button mounts and unmounts it leaving no scroll lock', async () => {
    const user = userEvent.setup();
    const analysis = await analyzeExample('dialog', 'Open');
    expect(analysis.mode).toBe('on-demand');

    const { html } = await serve(DialogIsland, { slug: 'dialog', storyName: 'Open', ...analysis });
    expect(html).not.toContain('wave-root');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(example('Open').textContent).toContain(
      'This example opens a dialog or panel. Use the button to show it.',
    );
    expectNoOverlayState();

    const show = screen.getByRole<HTMLButtonElement>('button', { name: 'Show example' });
    expect(show.disabled).toBe(false);
    await user.click(show);
    const dialog = await screen.findByRole('dialog');
    // The story's modal is live: the page behind it is locked.
    expect(
      document.documentElement.style.overflow === 'hidden' ||
        document.body.style.overflow === 'hidden',
    ).toBe(true);

    // The story's own close control works, then Close example unmounts it.
    await user.click(within(dialog).getByRole('button', { name: /close/i }));
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
    const close = within(example('Open')).getByRole('button', { name: 'Close example' });
    await user.click(close);
    expect(providerRoot()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show example' }));
    expectNoOverlayState();

    // Unmounting the island with the dialog open releases the page as well.
    await user.click(screen.getByRole('button', { name: 'Show example' }));
    await screen.findByRole('dialog');
    act(() => root?.unmount());
    root = undefined;
    document.querySelector('main')!.innerHTML = '';
    expectNoOverlayState();
  });
});

describe('theme and direction', () => {
  it('follows CHOICE_EVENT: dark and rtl reach the story', async () => {
    await serve(ButtonIsland, { slug: 'button', storyName: 'Default' });
    expect(providerRoot()!.classList.contains('wave-light')).toBe(true);
    expect(providerRoot()!.getAttribute('dir')).toBe('ltr');

    act(() => {
      document.documentElement.className = 'wave-dark';
      document.documentElement.dir = 'rtl';
      window.dispatchEvent(
        new CustomEvent(CHOICE_EVENT, { detail: { theme: 'dark', dir: 'rtl' } }),
      );
    });
    expect(providerRoot()!.classList.contains('wave-dark')).toBe(true);
    expect(providerRoot()!.getAttribute('dir')).toBe('rtl');

    act(() => {
      document.documentElement.className = 'wave-high-contrast';
      document.documentElement.dir = 'ltr';
      window.dispatchEvent(
        new CustomEvent(CHOICE_EVENT, { detail: { theme: 'high-contrast', dir: 'ltr' } }),
      );
    });
    expect(providerRoot()!.classList.contains('wave-high-contrast')).toBe(true);
    expect(providerRoot()!.getAttribute('dir')).toBe('ltr');
  });

  it('reads the choice the page made before hydration, after the first render', async () => {
    document.documentElement.className = 'wave-dark';
    document.documentElement.dir = 'rtl';
    const { html } = await serve(ButtonIsland, { slug: 'button', storyName: 'Default' });
    // The server markup is light and left to right; the effect then applies the page's choice.
    expect(html).toContain('wave-light');
    expect(providerRoot()!.classList.contains('wave-dark')).toBe(true);
    expect(providerRoot()!.getAttribute('dir')).toBe('rtl');
  });
});

describe('accessibility', () => {
  it('a rendered example with its controls open has no axe violations', async () => {
    const user = userEvent.setup();
    await serve(SwitchIsland, { slug: 'switch', storyName: 'Disabled' });
    await openControls(user, 'Disabled');
    const results = await axe.run(document, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`),
    ).toEqual([]);
  });
});

describe('Example.astro', () => {
  it('renders the slug’s own island, client:visible, with the analysis as props', async () => {
    const container = await AstroContainer.create({
      renderers: await loadRenderers([getContainerRenderer()]),
    });
    const page = await container.renderToString(ExampleAstro, {
      props: { slug: 'button', storyName: 'Default' },
    });
    const doc = new DOMParser().parseFromString(page, 'text/html');
    const island = doc.querySelector('astro-island')!;
    expect(island.getAttribute('client')).toBe('visible');
    expect(island.getAttribute('component-url')).toMatch(/\/generated\/examples\/button\.tsx$/);
    const props = JSON.parse(island.getAttribute('props')!) as Record<string, [number, unknown]>;
    expect(props.slug).toEqual([0, 'button']);
    expect(props.storyName).toEqual([0, 'Default']);
    expect(props.mode).toEqual([0, 'inline']);

    // Its server markup is the island's own, and it hydrates with no mismatch.
    const prefix = island.getAttribute('prefix')!;
    const expected = renderToString(
      <ButtonIsland slug="button" storyName="Default" mode="inline" />,
      {
        identifierPrefix: prefix,
      },
    );
    const inner = island.innerHTML.replace(/<!--astro:end-->$/, '');
    expect(inner).toBe(expected);

    const dialogPage = await container.renderToString(ExampleAstro, {
      props: { slug: 'dialog', storyName: 'Open' },
    });
    const dialogIsland = new DOMParser()
      .parseFromString(dialogPage, 'text/html')
      .querySelector('astro-island')!;
    expect(dialogIsland.getAttribute('component-url')).toMatch(
      /\/generated\/examples\/dialog\.tsx$/,
    );
    expect(
      (JSON.parse(dialogIsland.getAttribute('props')!) as Record<string, unknown>).mode,
    ).toEqual([0, 'on-demand']);
  });
});
