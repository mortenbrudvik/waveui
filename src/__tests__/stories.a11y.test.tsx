/**
 * Stories accessibility gate (spec §4.4, repo-level#24) and the Storybook preview annotations it
 * renders with (repo-level#23, #36).
 *
 * Every story of `stories/*.stories.tsx` is composed with the project annotations of
 * `.storybook/preview.tsx` (`setProjectAnnotations`, so the WaveProvider decorator and the
 * default light theme apply), rendered, and audited on `document.body` (portals included) with
 * `expectNoA11yViolations` from `src/test-utils.ts`: the shared axe instance (`region` disabled —
 * stories are components in isolation — and `color-contrast` disabled: jsdom cannot compute
 * colour contrast, which `src/styles/__tests__/tokens.test.ts` guards per theme, §4.5) plus the
 * dangling ARIA id reference check (`findDanglingIdRefs`).
 *
 * - The story files are loaded with a **non-eager** `import.meta.glob`: each file has its own
 *   `describe` that awaits the file's import, so a story file that fails to import (a syntax or
 *   import error in a file being edited) fails only its own block, as one failing test named
 *   `<title> › imports and composes` — the title read from the file's raw text, which loads even
 *   when the module does not compile, so `-t "<title>"` still selects (and fails) it.
 * - One test per story, named `<title> › <story>`; filter with `-t "<title or file name>"`.
 * - Opt-out: only `parameters: { a11y: { test: 'todo' } }` (story or meta level), which makes the
 *   story a `todo` here and a warning in Storybook's a11y panel. The same line or the line above
 *   must carry a comment explaining why; the gate fails a file whose opt-out has no comment.
 *   Other a11y parameters (`test: 'off'`, `disable`, rule configuration) do not exempt a story.
 */
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { composeStories, composeStory, setProjectAnnotations } from '@storybook/react';
import type { Decorator, Meta, ReactRenderer, StoryContext } from '@storybook/react';
import type { ComposedStoryFn, Store_CSFExports } from 'storybook/internal/types';
import preview from '../../.storybook/preview';
import { expectNoA11yViolations } from '../test-utils';

setProjectAnnotations(preview);

type StoryModule = Store_CSFExports<ReactRenderer> & { default: Meta };

const storyModules = import.meta.glob<StoryModule>('../../stories/*.stories.tsx');
const storySources = import.meta.glob<string>('../../stories/*.stories.tsx', {
  query: '?raw',
  import: 'default',
});

// ---------------------------------------------------------------------------
// Preview annotations
// ---------------------------------------------------------------------------

describe('Storybook preview annotations', () => {
  const toolbarValues = (name: string) =>
    (
      preview.globalTypes?.[name]?.toolbar?.items as Array<{ value: string } | string> | undefined
    )?.map((item) => (typeof item === 'string' ? item : item.value));

  it('fails stories on axe violations in the a11y panel (repo-level#24)', () => {
    expect(preview.parameters?.a11y).toEqual(expect.objectContaining({ test: 'error' }));
  });

  it('generates autodocs pages (repo-level#36)', () => {
    expect(preview.tags).toContain('autodocs');
  });

  it('has no dead Storybook 7 backgrounds block (repo-level#23)', () => {
    expect(preview.parameters?.backgrounds).toBeUndefined();
  });

  it('offers theme and direction toolbars, light and ltr by default (repo-level#23)', () => {
    expect(toolbarValues('theme')).toEqual(['light', 'dark', 'high-contrast']);
    expect(toolbarValues('dir')).toEqual(['ltr', 'rtl']);
    expect(preview.initialGlobals).toEqual({ theme: 'light', dir: 'ltr' });
  });

  describe('WaveProvider decorator', () => {
    const decorator = [preview.decorators ?? []].flat()[0] as Decorator;
    const renderWithGlobals = (globals: Record<string, unknown>) =>
      render(
        <>
          {decorator(
            () => (
              <p>Story content</p>
            ),
            { globals } as unknown as StoryContext<Record<string, unknown>>,
          )}
        </>,
      );
    const root = () => screen.getByText('Story content').closest('.wave-root');

    it.each([
      ['light', 'ltr', 'wave-light'],
      ['dark', 'rtl', 'wave-dark'],
      ['high-contrast', 'ltr', 'wave-high-contrast'],
    ])('renders the story in the %s theme, %s', (theme, dir, themeClass) => {
      renderWithGlobals({ theme, dir });
      expect(root()).toHaveClass('wave-root', themeClass);
      expect(root()).toHaveAttribute('dir', dir);
      expect(root()).toHaveAttribute('data-wave-theme', theme);
    });

    it('falls back to light and ltr for missing or unknown globals', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        renderWithGlobals({ theme: 'sepia', dir: 'sideways' });
        expect(root()).toHaveClass('wave-light');
        expect(root()).toHaveAttribute('dir', 'ltr');
        // The decorator passes only known values, so WaveProvider has nothing to warn about.
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('applies to composed stories through the project annotations', () => {
      const Story = composeStory({ render: () => <p>Story content</p> }, { title: 'Probe' });
      render(<Story />);
      expect(root()).toHaveClass('wave-light');
      expect(root()).toHaveAttribute('dir', 'ltr');
    });
  });
});

// ---------------------------------------------------------------------------
// Stories gate
// ---------------------------------------------------------------------------

/**
 * The gate's check of one story: renders it and audits `document.body` with
 * `expectNoA11yViolations` (`src/test-utils.ts`), which first lets the updates the story schedules
 * right after mount land inside `act()` — microtasks (announcers, measured layout), a macrotask
 * (popup positioning) and the next animation frame (Spinner's deferred announce), which would
 * otherwise fire while axe runs — and then fails on axe violations and on dangling ARIA id
 * references.
 */
async function auditStory(Story: React.ComponentType): Promise<void> {
  render(<Story />);
  await expectNoA11yViolations();
}

describe('auditStory', () => {
  // A deferred update like Spinner's announce: state set in the next animation frame.
  function FrameProbe() {
    const [ready, setReady] = React.useState(false);
    React.useEffect(() => {
      const frame = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(frame);
    }, []);
    return <p>{ready ? 'Ready' : 'Pending'}</p>;
  }

  it('lands updates scheduled for the next animation frame inside act()', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await auditStory(FrameProbe);
      expect(screen.getByText('Ready')).toBeInTheDocument();
      // Nothing is left to update outside act() while axe runs.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it('fails a story with an axe violation', async () => {
    await expect(auditStory(() => <button type="button" />)).rejects.toThrow(/button-name/);
  });

  it('fails a story with a dangling ARIA id reference', async () => {
    const Dangling = () => <input aria-label="Email" aria-describedby="email-hint" />;
    await expect(auditStory(Dangling)).rejects.toThrow(/aria-describedby="email-hint"/);
  });
});

/** Whether a composed story opted out with `parameters.a11y.test = 'todo'`. */
function isTodo(parameters: Record<string, unknown> | undefined): boolean {
  const a11y = parameters?.a11y as { test?: unknown } | undefined;
  return a11y?.test === 'todo';
}

/**
 * Lines (1-based) of `source` that set `test: 'todo'` without a comment on the same line or on
 * the line above.
 */
function uncommentedTodoOptOuts(source: string): number[] {
  const lines = source.split('\n');
  const comment = /\/\/|\/\*|\*\//;
  return lines.flatMap((line, index) =>
    /\btest\s*:\s*(['"`])todo\1/.test(line) &&
    !comment.test(line) &&
    !comment.test(lines[index - 1] ?? '')
      ? [index + 1]
      : [],
  );
}

/** Index just past the string literal or comment starting at `index` (or `index` itself). */
function skipLiteral(source: string, index: number): number {
  const char = source[index];
  if (char === '"' || char === "'" || char === '`') {
    let end = index + 1;
    while (end < source.length && source[end] !== char) end += source[end] === '\\' ? 2 : 1;
    return end + 1;
  }
  if (source.startsWith('//', index)) {
    const end = source.indexOf('\n', index);
    return end === -1 ? source.length : end;
  }
  if (source.startsWith('/*', index)) {
    const end = source.indexOf('*/', index + 2);
    return end === -1 ? source.length : end + 2;
  }
  return index;
}

/**
 * The `title` of a story file's default export (its CSF meta), read from the raw source without
 * compiling it: `export default { title: '…' }` or `const meta = { title: '…' }; export default
 * meta;`. Only a top-level `title` of that object counts (not a `title` inside args or
 * fixtures). Undefined when there is none (auto-title) or the source is too broken to tell.
 */
function metaTitle(source: string): string | undefined {
  const exported = /export\s+default\s+(\{|[A-Za-z_$][\w$]*)/.exec(source);
  if (!exported) return undefined;
  let start = exported.index + exported[0].length - 1;
  if (exported[1] !== '{') {
    const declaration = new RegExp(
      `\\b(?:const|let|var)\\s+${exported[1].replace(/\$/g, '\\$')}\\b[^=;]*=\\s*\\{`,
    ).exec(source);
    if (!declaration) return undefined;
    start = declaration.index + declaration[0].length - 1;
  }
  let depth = 0;
  let index = start;
  while (index < source.length) {
    const next = skipLiteral(source, index);
    if (next !== index) {
      index = next;
      continue;
    }
    const char = source[index];
    if (char === '{' || char === '[' || char === '(') depth++;
    else if (char === '}' || char === ']' || char === ')') {
      depth--;
      if (depth === 0) return undefined;
    } else if (depth === 1 && /[\s,{]/.test(source[index - 1] ?? '')) {
      const title = /^title\s*:\s*(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/.exec(source.slice(index));
      if (title) return title[2];
    }
    index++;
  }
  return undefined;
}

describe('metaTitle', () => {
  it('reads the title of the default-exported meta object', () => {
    expect(metaTitle("export default { title: 'Layout/Card', component: Card };")).toBe(
      'Layout/Card',
    );
    expect(
      metaTitle(
        [
          "const sampleSteps = [{ title: 'Welcome to the App' }];",
          'const meta: Meta<typeof TeachingPopover> = {',
          '  // title: "Commented/Out",',
          "  args: { title: 'Arg title', steps: sampleSteps },",
          "  subtitle: 'Not the title',",
          "  render: () => <p title='x'>{'}'}</p>,",
          '  title: "Components/Overlays/TeachingPopover",',
          '} satisfies Meta<typeof TeachingPopover>;',
          'export default meta;',
        ].join('\n'),
      ),
    ).toBe('Components/Overlays/TeachingPopover');
  });

  it('is undefined without a meta title or when the source cannot be read', () => {
    expect(metaTitle('const meta = { component: Card };\nexport default meta;')).toBeUndefined();
    expect(metaTitle("export default meta;\nconst other = { title: 'x' };")).toBeUndefined();
    expect(metaTitle("const meta = { title: 'Unterminated")).toBeUndefined();
  });
});

describe('uncommentedTodoOptOuts', () => {
  it('accepts opt-outs explained on the same line or the line above', () => {
    expect(
      uncommentedTodoOptOuts(
        [
          "parameters: { a11y: { test: 'todo' } }, // TagPicker listbox: input-pickers#28",
          '// Needs the Menu rework (feedback-navigation#23)',
          "parameters: { a11y: { test: 'todo' } },",
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('reports opt-outs without a comment', () => {
    expect(
      uncommentedTodoOptOuts(['args: {},', "parameters: { a11y: { test: 'todo' } },"].join('\n')),
    ).toEqual([2]);
  });
});

for (const [path, load] of Object.entries(storyModules).sort(([a], [b]) => a.localeCompare(b))) {
  const file = path.replace(/^(\.\.\/)+/, '');

  describe(file, async () => {
    // The raw text loads even when the module does not compile, so every test of the block —
    // the import failure included — carries the story title that `-t "<title>"` filters on.
    let source = '';
    try {
      source = await storySources[path]();
    } catch {
      // The module import below reports the file.
    }
    // A throw in an async describe would fail the whole test file, so a story file that cannot
    // be imported or composed becomes one failing test of its own block.
    let stories: Array<[string, ComposedStoryFn<ReactRenderer>]>;
    let title: string;
    try {
      const mod = await load();
      title = mod.default.title ?? metaTitle(source) ?? file;
      stories = Object.entries(composeStories(mod)) as Array<
        [string, ComposedStoryFn<ReactRenderer>]
      >;
    } catch (error) {
      it(`${metaTitle(source) ?? file} › imports and composes`, () => {
        throw error;
      });
      return;
    }

    if (/\btest\s*:\s*(['"`])todo\1/.test(source)) {
      it(`${title} › explains every a11y.test: 'todo' opt-out with a comment`, () => {
        expect(uncommentedTodoOptOuts(source)).toEqual([]);
      });
    }

    it(`${title} › has stories`, () => {
      expect(stories.length).toBeGreaterThan(0);
    });

    for (const [exportName, Story] of stories) {
      const name = `${title} › ${Story.storyName ?? exportName}`;
      if (isTodo(Story.parameters)) {
        it.todo(`${name} (a11y.test: 'todo')`);
        continue;
      }
      it(name, async () => {
        await auditStory(Story);
      });
    }
  });
}
