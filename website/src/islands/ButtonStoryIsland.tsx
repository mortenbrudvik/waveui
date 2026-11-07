/**
 * Spike island: the `Default` story of stories/Button.stories.tsx, composed by Storybook's portable
 * stories API with `.storybook/preview.tsx` as the project annotations (its `WaveProvider`
 * decorator, and its two stylesheets: the library sheet and the stories' own classes).
 */
import { composeStory } from '@storybook/react';
import preview from '../../../.storybook/preview';
import meta, { Default } from '../../../stories/Button.stories';

const ButtonDefault = composeStory(Default, meta, preview);

export default function ButtonStoryIsland() {
  return <ButtonDefault />;
}
