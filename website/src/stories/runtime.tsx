/**
 * The story runtime: renders a story of the library's own `stories/*.stories.tsx` modules on the
 * site, on the server for the static preview and in the browser for the example island.
 * `loadStory(entry, name)` imports the one story file it needs (server code: its map makes every
 * story file a dynamic import of a client bundle); `composeStoryExport` composes a story of a
 * module the caller imported, which is what an island does, importing its stories by name so the
 * bundler drops the file's others (website/SPIKE.md, "Outcome").
 *
 * It is a small composer of its own, not Storybook's `composeStory`: that brings Storybook's
 * preview runtime to the browser, about 145 KiB gzipped (website/SPIKE.md), more than the rest of a
 * component page. The stories need only this much of it:
 *
 * - args: the meta's, then the story's (shallow, as Storybook spreads them); the props given to
 *   `Component` override both, which is how the prop controls re-render a story;
 * - argTypes: the meta's and the story's merged key by key (Storybook's `combineParameters`);
 * - render: the story's `render`, else the meta's, else `<meta.component {...args} />`;
 * - decorators: the story's, then the meta's, then {@link projectAnnotations}', innermost first, as
 *   Storybook orders them; each runs as a component of its own, so a decorator or a render function
 *   may call hooks;
 * - name: the story's `name`, else its export in start case (Storybook's `storyNameFromExport`).
 *
 * Loaders, `play`, `beforeEach`, globals and the addons' parameters are ignored; `storybook/test` is
 * aliased to `storybook-test-shim.ts` (astro.config.mjs), so a story's `fn()` is a no-op. Nothing
 * here imports Storybook: the runtime.test.tsx cross-check renders the same stories with
 * `composeStory` and compares the markup.
 */
import * as React from 'react';
import { WaveProvider, type WaveDir, type WaveTheme } from '../../../src';
import type { ComponentEntry } from '../catalog/catalog';

type Args = Record<string, unknown>;

/** A loaded `*.stories.tsx` module: the meta as `default`, a story per named export. */
export type StoryModule = Readonly<Record<string, unknown>>;

/** The part of Storybook's story context that the stories' decorators and render functions read. */
export interface SiteStoryContext {
  /** `<storyFile>#<ExportName>`. */
  id: string;
  name: string;
  title: string;
  args: Args;
  argTypes: Args;
  parameters: Args;
  globals: Args;
  component: React.ElementType | undefined;
}

export type SiteDecorator = (
  Story: React.ComponentType,
  context: SiteStoryContext,
) => React.ReactNode;
type SiteRender = (args: Args, context: SiteStoryContext) => React.ReactNode;

interface Annotations {
  args?: Args;
  argTypes?: Args;
  parameters?: Args;
  decorators?: SiteDecorator | readonly SiteDecorator[];
  render?: SiteRender;
}

interface MetaAnnotations extends Annotations {
  title?: string;
  component?: React.ElementType;
}

interface StoryAnnotations extends Annotations {
  name?: string;
  storyName?: string;
}

/** A story ready to render, with its merged args and argTypes. */
export interface ComposedStory {
  /** The story inside its decorators; its props override the story's args. */
  Component: React.ComponentType<Record<string, unknown>>;
  args: Record<string, unknown>;
  argTypes: Record<string, unknown>;
  name: string;
}

/** A story that cannot be loaded or whose render function throws, named by `story`. */
export class StoryError extends Error {
  /** `<storyFile>#<ExportName>`. */
  readonly story: string;

  constructor(story: string, problem: string, options?: ErrorOptions) {
    super(`Story "${story}" ${problem}`, options);
    this.name = 'StoryError';
    this.story = story;
  }
}

/** The site's theme and direction, which the project decorator hands to `WaveProvider`. */
export interface SiteChoice {
  theme: WaveTheme;
  dir: WaveDir;
}

/** Light and left to right unless the page provides another choice. */
export const SiteChoiceContext = React.createContext<SiteChoice>({ theme: 'light', dir: 'ltr' });

function SiteWaveProvider({ children }: { children: React.ReactNode }) {
  const { theme, dir } = React.useContext(SiteChoiceContext);
  return (
    <WaveProvider theme={theme} dir={dir}>
      {children}
    </WaveProvider>
  );
}

/**
 * The site's project annotations, the counterpart of `.storybook/preview.tsx` (which the site does
 * not import: its stylesheets are the site's business): one decorator, `WaveProvider` with the
 * theme and direction of {@link SiteChoiceContext}.
 */
export const projectAnnotations: { decorators: readonly SiteDecorator[] } = {
  decorators: [
    (Story) => (
      <SiteWaveProvider>
        <Story />
      </SiteWaveProvider>
    ),
  ],
};

function isPlainObject(value: unknown): value is Args {
  if (value === null || typeof value !== 'object') return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Storybook's `combineParameters`: plain objects merge deeply, other values replace, and
 * `undefined` never does.
 */
function combine(...sets: (Args | undefined)[]): Args {
  const defined = sets.filter((set): set is Args => Boolean(set));
  const combined: Args = {};
  const mergeKeys = new Set<string>();
  for (const set of defined) {
    for (const [key, value] of Object.entries(set)) {
      const existing = combined[key];
      if (Array.isArray(value) || existing === undefined) combined[key] = value;
      else if (isPlainObject(value) && isPlainObject(existing)) mergeKeys.add(key);
      else if (value !== undefined) combined[key] = value;
    }
  }
  for (const key of mergeKeys) {
    const values = defined.map((set) => set[key]).filter((value) => value !== undefined);
    combined[key] = values.every(isPlainObject) ? combine(...values) : values[values.length - 1];
  }
  return combined;
}

/** Storybook's `storyNameFromExport` (`WithIcon` is "With Icon"). */
export function storyNameFromExport(exportName: string): string {
  return exportName
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\./g, ' ')
    .replace(/([^\n])([A-Z])([a-z])/g, (_, a: string, b: string, c: string) => `${a} ${b}${c}`)
    .replace(/([a-z])([A-Z])/g, (_, a: string, b: string) => `${a} ${b}`)
    .replace(/([a-z])([0-9])/gi, (_, a: string, b: string) => `${a} ${b}`)
    .replace(/([0-9])([a-z])/gi, (_, a: string, b: string) => `${a} ${b}`)
    .replace(/(\s|^)(\w)/g, (_, a: string, b: string) => `${a}${b.toUpperCase()}`)
    .replace(/ +/g, ' ')
    .trim();
}

function asArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? (value as readonly T[]) : [value as T];
}

/**
 * React suspends a render by throwing a thenable, or for `use()` one of its "Suspense Exception"
 * errors; those must reach React unchanged.
 */
function isReactSignal(error: unknown): boolean {
  if (error instanceof Error) return error.message.startsWith('Suspense Exception');
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { then?: unknown }).then === 'function'
  );
}

const renderComponent: SiteRender = (args, context) => {
  const Component = context.component;
  if (!Component) throw new Error('has no render function and its meta has no component');
  return <Component {...args} />;
};

/** The context of the story being rendered, read by its decorators and its render function. */
const StoryContext = React.createContext<SiteStoryContext | null>(null);

function useStoryContext(): SiteStoryContext {
  const context = React.useContext(StoryContext);
  if (!context) throw new Error('a story part rendered outside its story');
  return context;
}

/** Story annotations from a story export: a story object, or a CSF 2 function story. */
function readStoryExport(value: unknown): StoryAnnotations | undefined {
  if (typeof value === 'function') {
    const fn = value as SiteRender & StoryAnnotations;
    return {
      args: fn.args,
      argTypes: fn.argTypes,
      parameters: fn.parameters,
      decorators: fn.decorators,
      render: fn,
      name: fn.storyName,
    };
  }
  return isPlainObject(value) ? (value as StoryAnnotations) : undefined;
}

function composeSiteStory(
  id: string,
  exportName: string,
  meta: MetaAnnotations,
  story: StoryAnnotations,
): ComposedStory {
  const args: Args = { ...meta.args, ...story.args };
  const argTypes = combine(meta.argTypes, story.argTypes);
  const parameters = combine(meta.parameters, story.parameters);
  const name = story.name ?? story.storyName ?? storyNameFromExport(exportName);
  const render = story.render ?? meta.render ?? renderComponent;
  const decorators = [
    ...asArray(story.decorators),
    ...asArray(meta.decorators),
    ...projectAnnotations.decorators,
  ];

  // The chain is built once per story, so a re-render with new args keeps the story mounted.
  function StoryRender(): React.ReactNode {
    const context = useStoryContext();
    try {
      return render(context.args, context);
    } catch (error) {
      if (isReactSignal(error)) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new StoryError(id, `failed to render: ${message}`, { cause: error });
    }
  }
  let Story: React.ComponentType = StoryRender;
  for (const decorator of decorators) {
    const Inner: React.ComponentType = Story;
    Story = function DecoratedStory(): React.ReactNode {
      return decorator(Inner, useStoryContext());
    };
  }
  const Decorated = Story;

  function Component(props: Record<string, unknown>) {
    const context: SiteStoryContext = {
      id,
      name,
      title: meta.title ?? '',
      args: { ...args, ...props },
      argTypes,
      parameters,
      globals: {},
      component: meta.component,
    };
    return (
      <StoryContext value={context}>
        <Decorated />
      </StoryContext>
    );
  }
  Component.displayName = `Story(${id})`;

  return { Component, args, argTypes, name };
}

/**
 * Composes the story `storyName` of a story module already imported, synchronously (for a module
 * imported statically). Throws a {@link StoryError} for a module without a meta or a name that is
 * no story of it.
 */
export function composeStoryExport(
  storyFile: string,
  module: StoryModule,
  storyName: string,
): ComposedStory {
  const id = `${storyFile}#${storyName}`;
  const meta = module.default;
  if (!isPlainObject(meta)) throw new StoryError(id, 'is in a module without a default meta');
  const story = storyName === 'default' ? undefined : readStoryExport(module[storyName]);
  if (!story) throw new StoryError(id, 'is no story export of its module');
  const metaAnnotations = meta as MetaAnnotations;
  if (!story.render && !metaAnnotations.render && !metaAnnotations.component) {
    throw new StoryError(id, 'has no render function and its meta has no component');
  }
  return composeSiteStory(id, storyName, metaAnnotations, story);
}

/** Loads one story module, by the story file's path from the repository root. */
export type StoryModuleLoaders = Readonly<Record<string, () => Promise<StoryModule>>>;

/**
 * A `loadStory` over `loaders`: it imports only the story file it is asked for and composes only
 * the named story. A file it has no loader for, an import that fails and a missing export reject
 * with a {@link StoryError} that names the story.
 */
export function createStoryLoader(loaders: StoryModuleLoaders) {
  return async function load(
    entry: Pick<ComponentEntry, 'storyFile'>,
    storyName: string,
  ): Promise<ComposedStory> {
    const loader = loaders[entry.storyFile];
    if (!loader) {
      throw new StoryError(
        `${entry.storyFile}#${storyName}`,
        'is in no story file the site can load',
      );
    }
    let module: StoryModule;
    try {
      module = await loader();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new StoryError(`${entry.storyFile}#${storyName}`, `could not be loaded: ${message}`, {
        cause: error,
      });
    }
    return composeStoryExport(entry.storyFile, module, storyName);
  };
}

/**
 * The component stories, one lazy chunk per file. The two `Guides/` stories document no component
 * (the catalog leaves them out) and Charts would bring Recharts and Chart.js into the build. Vite
 * marks the glob's object pure, and the map below is built on first use, so a bundle that imports
 * only {@link composeStoryExport} holds no loader of any story file.
 */
const globbed = import.meta.glob<StoryModule>([
  '../../../stories/*.stories.tsx',
  '!../../../stories/Charts.stories.tsx',
  '!../../../stories/Icons.stories.tsx',
]);

let siteLoaders: StoryModuleLoaders | undefined;
let loadSiteStory: ReturnType<typeof createStoryLoader> | undefined;

function getSiteLoaders(): StoryModuleLoaders {
  siteLoaders ??= Object.fromEntries(
    Object.entries(globbed).map(([path, loader]) => [path.replace(/^(?:\.\.\/)+/, ''), loader]),
  );
  return siteLoaders;
}

/** The story files `loadStory` can load, relative to the repository root (`stories/Button.stories.tsx`). */
export function getStoryFiles(): string[] {
  return Object.keys(getSiteLoaders());
}

/** Loads and composes one story of a catalog entry: `loadStory(entry, 'Default')`. */
export function loadStory(entry: ComponentEntry, storyName: string): Promise<ComposedStory> {
  loadSiteStory ??= createStoryLoader(getSiteLoaders());
  return loadSiteStory(entry, storyName);
}
