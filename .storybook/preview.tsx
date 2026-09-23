import * as React from 'react';
import type { Preview } from '@storybook/react';
import { WaveProvider } from '../src/components/provider/WaveProvider';
import type { WaveDir, WaveTheme } from '../src/components/provider/WaveProvider';
import './preview.css';

const themes: ReadonlyArray<{ value: WaveTheme; title: string }> = [
  { value: 'light', title: 'Light' },
  { value: 'dark', title: 'Dark' },
  { value: 'high-contrast', title: 'High contrast' },
];

const directions: ReadonlyArray<{ value: WaveDir; title: string }> = [
  { value: 'ltr', title: 'Left to right' },
  { value: 'rtl', title: 'Right to left' },
];

/** The global's value when it is one of `options`, else the first option (the default). */
function pick<T extends string>(value: unknown, options: ReadonlyArray<{ value: T }>): T {
  return options.find((option) => option.value === value)?.value ?? options[0].value;
}

const preview: Preview = {
  /** Every component with a story gets a Docs page from its JSDoc and props (repo-level#36). */
  tags: ['autodocs'],
  parameters: {
    /**
     * Axe violations fail the story's a11y test (repo-level#24). A story may opt down to
     * `'todo'` only with a comment explaining why; src/__tests__/stories.a11y.test.tsx runs the
     * same audit in CI.
     */
    a11y: { test: 'error' },
  },
  /** Theme and direction toolbars (repo-level#23), read by the WaveProvider decorator. */
  globalTypes: {
    theme: {
      description: 'Wave theme of the story (WaveProvider `theme`)',
      toolbar: { title: 'Theme', icon: 'paintbrush', items: [...themes], dynamicTitle: true },
    },
    dir: {
      description: 'Text direction of the story (WaveProvider `dir`)',
      toolbar: { title: 'Direction', icon: 'transfer', items: [...directions], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light', dir: 'ltr' },
  decorators: [
    (Story, { globals }) => (
      <WaveProvider theme={pick(globals.theme, themes)} dir={pick(globals.dir, directions)}>
        <Story />
      </WaveProvider>
    ),
  ],
};

export default preview;
