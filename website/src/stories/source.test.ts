import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractStorySource } from './source';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BUTTON_STORIES = 'stories/Button.stories.tsx';
const buttonText = readFileSync(resolve(REPO_ROOT, BUTTON_STORIES), 'utf8').replace(/\r\n/g, '\n');

/** The text from `start` to the end of its statement (`};` at the start of a line). */
function statementFrom(start: string): string {
  const from = buttonText.indexOf(start);
  expect(from, start).toBeGreaterThan(-1);
  const end = buttonText.indexOf('\n};', from);
  return buttonText.slice(from, end + '\n};'.length);
}

describe('extractStorySource', () => {
  it("returns the story's source text including its args", () => {
    const source = extractStorySource(BUTTON_STORIES, 'Primary');
    expect(source).toBe(statementFrom('export const Primary: Story = {'));
    expect(source).toBe(
      [
        'export const Primary: Story = {',
        '  args: {',
        "    appearance: 'primary',",
        "    children: 'Primary',",
        '  },',
        '};',
      ].join('\n'),
    );
  });

  it('returns the text of render() for a render story', () => {
    const source = extractStorySource(BUTTON_STORIES, 'Sizes');
    expect(source).toBe(statementFrom('export const Sizes: Story = {'));
    expect(source).toContain('  render: (args) => (\n');
    expect(source).toContain('{sizes.map((size) => (');
    expect(source).toContain('<Button key={size} {...args} size={size}>');
    // A story with both: its args and its render function.
    const both = extractStorySource(BUTTON_STORIES, 'DisabledFocusable');
    expect(both).toContain("children: 'Save',");
    expect(both).toContain('<Tooltip content="Make a change before you save">');
  });

  it("leaves out the story's JSDoc, which is its description, not its code", () => {
    const source = extractStorySource(BUTTON_STORIES, 'IconAfter');
    expect(source).toMatch(/^export const IconAfter: Story = \{\n/);
    expect(source).not.toContain('inline end of the label');
  });

  it('unknown export throws a clear error', () => {
    expect(() => extractStorySource(BUTTON_STORIES, 'NoSuchStory')).toThrow(
      'stories/Button.stories.tsx has no story export named "NoSuchStory"',
    );
    // The meta is no story.
    expect(() => extractStorySource(BUTTON_STORIES, 'meta')).toThrow(
      'stories/Button.stories.tsx has no story export named "meta"',
    );
    expect(() => extractStorySource('stories/NoSuch.stories.tsx', 'Default')).toThrow(
      /stories\/NoSuch\.stories\.tsx/,
    );
  });
});
