/**
 * The live example of one story (the spec's "Examples and controls"), as an island. A page renders
 * it through `Example.astro`, which hydrates the catalog entry's own generated island
 * (`src/generated/examples/<slug>.tsx`, written by `src/examples/islands.ts`): each of those
 * imports one story file, its meta and its stories by name, and calls {@link createExampleIsland},
 * so a page's client code holds only the stories it shows. Islands never call `loadStory`, whose
 * map of every story file is server code (website/SPIKE.md, "Outcome").
 *
 * What the island does:
 *
 * - The static preview is the story with its default args, light and left to right, rendered on
 *   the server; it needs no script. Once hydrated (`client:visible`) the example follows the
 *   page's theme and direction: it reads `<html>` in an effect (so the first client render matches
 *   the server's) and again on every `CHOICE_EVENT`, and hands them to the story's `WaveProvider`
 *   through `SiteChoiceContext`.
 * - The prop controls: a Controls toggle (disabled until the island runs) opens them below the
 *   preview. Their chunk (`Controls.tsx`) is imported on the first focus or pointer entering the
 *   example, through {@link controlsChunk}, never before; a story with no arg a control supports
 *   (`controlSpecs.ts`) has no toggle and loads nothing. A change re-renders the mounted story with
 *   the new args.
 * - A story that opens a modal as it renders (`mode: 'on-demand'`, detected at build time by
 *   `src/examples/analysis.tsx`) is not rendered until the reader asks: a caption and Show example
 *   mount it, and Close example unmounts it (which releases its scroll lock and focus trap) and
 *   returns focus to Show example.
 * - Errors: a story that failed on the server (`serverError`, from the analysis, which renders the
 *   whole story in a `try`) shows a panel naming the story and the message in the static page, and
 *   the browser tries it once more after hydration (a story that reads `window` renders there); an
 *   error in the browser is caught by an error boundary that shows the same panel.
 */
import * as React from 'react';
import { Button } from '../../../src';
import { CHOICE_EVENT } from '../shell/events';
import {
  composeStoryExport,
  SiteChoiceContext,
  type ComposedStory,
  type SiteChoice,
  type StoryModule,
} from '../stories/runtime';
import { readDocumentChoice } from '../theme/themeChoice';
import type { ControlsProps } from './Controls';
import { getControlSpecs } from './controlSpecs';

/** `inline`: rendered in the page; `on-demand`: mounted by Show example (it opens a modal). */
export type ExampleMode = 'inline' | 'on-demand';

export interface ExampleIslandProps {
  /** The catalog slug of the page, which names the story in an error panel. */
  slug: string;
  /** The story's export name. */
  storyName: string;
  /** @default 'inline' */
  mode?: ExampleMode | undefined;
  /** The message of the error the story threw on the server, if it did. */
  serverError?: string | undefined;
}

/**
 * Loads the controls chunk. An object, so a test can spy on the dynamic import; the island calls
 * it on the first focus or pointer entering an example with controls.
 */
export const controlsChunk = {
  load: (): Promise<{ Controls: React.ComponentType<ControlsProps> }> => import('./Controls'),
};

const DEFAULT_CHOICE: SiteChoice = { theme: 'light', dir: 'ltr' };

const MODAL_CAPTION = 'This example opens a dialog or panel. Use the button to show it.';

function ErrorPanel({
  label,
  problem,
  message,
}: {
  label: string;
  problem: string;
  message: string;
}) {
  return (
    <div
      data-example-error=""
      className="flex flex-col gap-1 rounded border border-wave-error bg-wave-error-tint p-3 text-wave-body-1 text-wave-error-tint-foreground"
    >
      <p className="m-0 font-semibold">{`Example “${label}” ${problem}.`}</p>
      <p className="m-0 font-wave-mono text-wave-caption-1 break-words">{message}</p>
    </div>
  );
}

interface BoundaryProps {
  label: string;
  /** The args object: a new one (a control changed) tries the story again after an error. */
  resetKey: unknown;
  children: React.ReactNode;
}

/**
 * Catches an error of the story in the browser and shows the panel in its place. It keeps the
 * story mounted across arg changes; only after an error does a new `resetKey` render it again.
 */
class StoryBoundary extends React.Component<BoundaryProps, { error: unknown }> {
  override state: { error: unknown } = { error: undefined };

  static getDerivedStateFromError(error: unknown) {
    return { error: error ?? new Error('unknown error') };
  }

  override componentDidUpdate(previous: BoundaryProps) {
    if (this.state.error !== undefined && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: undefined });
    }
  }

  override render() {
    const { error } = this.state;
    if (error === undefined) return this.props.children;
    return (
      <ErrorPanel
        label={this.props.label}
        problem="failed to render"
        message={error instanceof Error ? error.message : String(error)}
      />
    );
  }
}

type Composed = { story: ComposedStory; error?: undefined } | { story?: undefined; error: string };

function compose(storyFile: string, module: StoryModule, storyName: string): Composed {
  try {
    return { story: composeStoryExport(storyFile, module, storyName) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

interface ExampleProps extends ExampleIslandProps {
  storyFile: string;
  module: StoryModule;
}

function Example({
  storyFile,
  module,
  slug,
  storyName,
  mode = 'inline',
  serverError,
}: ExampleProps) {
  const label = `${slug} › ${storyName}`;
  const composed = React.useMemo(
    () => compose(storyFile, module, storyName),
    [storyFile, module, storyName],
  );
  const story = composed.story;
  const hasControls = React.useMemo(
    () => (story ? getControlSpecs(story.argTypes, story.args).length > 0 : false),
    [story],
  );

  const [hydrated, setHydrated] = React.useState(false);
  const [choice, setChoice] = React.useState<SiteChoice>(DEFAULT_CHOICE);
  const [args, setArgs] = React.useState<Record<string, unknown> | undefined>(undefined);
  const [shown, setShown] = React.useState(false);
  const [controlsOpen, setControlsOpen] = React.useState(false);
  const [Controls, setControls] = React.useState<React.ComponentType<ControlsProps> | null>(null);
  const controlsRequested = React.useRef(false);
  const showButtonRef = React.useRef<HTMLButtonElement>(null);
  const focusShowButton = React.useRef(false);
  const controlsId = React.useId();

  React.useEffect(() => {
    setChoice(readDocumentChoice());
    setHydrated(true);
    const follow = () => setChoice(readDocumentChoice());
    window.addEventListener(CHOICE_EVENT, follow);
    return () => window.removeEventListener(CHOICE_EVENT, follow);
  }, []);

  React.useEffect(() => {
    if (shown || !focusShowButton.current) return;
    focusShowButton.current = false;
    showButtonRef.current?.focus();
  }, [shown]);

  const requestControls = () => {
    if (!hasControls || controlsRequested.current) return;
    controlsRequested.current = true;
    controlsChunk.load().then(
      (chunk) => setControls(() => chunk.Controls),
      () => {
        // A failed chunk (offline) is tried again on the next focus or pointer entering.
        controlsRequested.current = false;
      },
    );
  };

  const currentArgs = args ?? story?.args ?? {};

  let preview: React.ReactNode;
  if (!story) {
    preview = <ErrorPanel label={label} problem="could not be loaded" message={composed.error} />;
  } else if (serverError !== undefined && !hydrated) {
    preview = (
      <ErrorPanel
        label={label}
        problem="could not be rendered on the server"
        message={serverError}
      />
    );
  } else if (mode === 'on-demand' && !shown) {
    preview = (
      <div className="flex flex-col items-start gap-3">
        <p className="m-0 text-wave-body-1 text-wave-muted-foreground">{MODAL_CAPTION}</p>
        <Button ref={showButtonRef} disabled={!hydrated} onClick={() => setShown(true)}>
          Show example
        </Button>
      </div>
    );
  } else {
    preview = (
      <StoryBoundary resetKey={currentArgs} label={label}>
        <SiteChoiceContext value={choice}>
          <story.Component {...currentArgs} />
        </SiteChoiceContext>
      </StoryBoundary>
    );
  }

  const showsCloseExample = mode === 'on-demand' && shown;

  return (
    <div
      role="group"
      aria-label={`Example: ${story?.name ?? storyName}`}
      data-example={`${slug}/${storyName}`}
      className="flex min-w-0 flex-col rounded-md border border-wave-border"
      onPointerEnter={requestControls}
      onFocus={requestControls}
    >
      <div data-example-preview="" className="min-w-0 overflow-x-auto p-4">
        {preview}
      </div>
      {hasControls || showsCloseExample ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-wave-border px-3 py-2">
          {hasControls ? (
            <Button
              size="small"
              appearance="subtle"
              disabled={!hydrated}
              aria-expanded={controlsOpen}
              aria-controls={controlsId}
              onClick={() => {
                requestControls();
                setControlsOpen((open) => !open);
              }}
            >
              Controls
            </Button>
          ) : null}
          {showsCloseExample ? (
            <Button
              size="small"
              appearance="subtle"
              onClick={() => {
                focusShowButton.current = true;
                setShown(false);
              }}
            >
              Close example
            </Button>
          ) : null}
        </div>
      ) : null}
      {hasControls ? (
        <div id={controlsId} hidden={!controlsOpen} className="border-t border-wave-border p-3">
          {controlsOpen && story ? (
            Controls ? (
              <Controls argTypes={story.argTypes} args={currentArgs} onChange={setArgs} />
            ) : (
              <p className="m-0 text-wave-caption-1 text-wave-muted-foreground">
                Loading controls…
              </p>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The island of one story file: `createExampleIsland('stories/Button.stories.tsx', { default:
 * meta, Default, Primary })` in a generated module, whose default export Astro hydrates.
 */
export function createExampleIsland(
  storyFile: string,
  module: StoryModule,
): React.ComponentType<ExampleIslandProps> {
  function ExampleIsland(props: ExampleIslandProps) {
    return <Example storyFile={storyFile} module={module} {...props} />;
  }
  ExampleIsland.displayName = `ExampleIsland(${storyFile})`;
  return ExampleIsland;
}
