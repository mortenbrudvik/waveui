import { describe, expect, it } from 'vitest';
import {
  exampleAnchor,
  exampleAnchors,
  formatDescription,
  isHookEntry,
  metaDescription,
  pageSections,
} from './page';

describe('formatDescription', () => {
  it('splits paragraphs on blank lines and joins wrapped lines with a space', () => {
    expect(formatDescription('One line\nwrapped here.\n\n  Second paragraph.  \n')).toEqual([
      [[{ code: false, text: 'One line wrapped here.' }]],
      [[{ code: false, text: 'Second paragraph.' }]],
    ]);
  });

  it('turns a backtick span into code and keeps everything else as text', () => {
    expect(formatDescription('Renders a `<button type="button">` by <b>default</b>.')).toEqual([
      [
        [
          { code: false, text: 'Renders a ' },
          { code: true, text: '<button type="button">' },
          { code: false, text: ' by <b>default</b>.' },
        ],
      ],
    ]);
  });

  it('keeps an unmatched backtick and markdown marks as text', () => {
    expect(formatDescription('A ` alone and **bold** and [a](b)')).toEqual([
      [[{ code: false, text: 'A ` alone and **bold** and [a](b)' }]],
    ]);
  });

  it('starts a new line at a line that begins with a list marker, keeping the marker', () => {
    expect(formatDescription('Intro:\n- first\n  continued\n- `second`\n1. third')).toEqual([
      [
        [{ code: false, text: 'Intro:' }],
        [{ code: false, text: '- first continued' }],
        [
          { code: false, text: '- ' },
          { code: true, text: 'second' },
        ],
        [{ code: false, text: '1. third' }],
      ],
    ]);
  });

  it('writes a JSDoc link as its target or its text', () => {
    expect(
      formatDescription('See {@link Button} and {@link TagOwnProps.dismissIcon the icon}.'),
    ).toEqual([[[{ code: false, text: 'See Button and the icon.' }]]]);
  });

  it('gives nothing for an empty or blank text', () => {
    expect(formatDescription('')).toEqual([]);
    expect(formatDescription('  \n\n ')).toEqual([]);
  });

  it('normalises Windows line endings', () => {
    expect(formatDescription('a\r\nb\r\n\r\nc')).toEqual([
      [[{ code: false, text: 'a b' }]],
      [[{ code: false, text: 'c' }]],
    ]);
  });
});

describe('pageSections', () => {
  it('lists every section that has content, in page order', () => {
    expect(pageSections({ examples: 3, propsTable: true, parts: 2, classNames: true })).toEqual([
      { id: 'examples', title: 'Examples' },
      { id: 'props', title: 'Props' },
      { id: 'parts', title: 'Parts' },
      { id: 'class-names', title: 'Stable class names' },
    ]);
  });

  it('leaves out the sections without content', () => {
    expect(pageSections({ examples: 1, propsTable: false, parts: 0, classNames: false })).toEqual([
      { id: 'examples', title: 'Examples' },
    ]);
    expect(pageSections({ examples: 0, propsTable: true, parts: 0, classNames: true })).toEqual([
      { id: 'props', title: 'Props' },
      { id: 'class-names', title: 'Stable class names' },
    ]);
  });
});

describe('page helpers', () => {
  it('isHookEntry is true for a use… export only', () => {
    expect(isHookEntry({ exportName: 'useTableFeatures' })).toBe(true);
    expect(isHookEntry({ exportName: 'useModalLayer' })).toBe(true);
    expect(isHookEntry({ exportName: 'Button' })).toBe(false);
    expect(isHookEntry({ exportName: 'user' })).toBe(false);
  });

  it('exampleAnchors gives every story a distinct id, a numeric suffix after a collision', () => {
    expect(exampleAnchors(['Size_Large', 'SizeLarge', 'Default', 'Size-Large'])).toEqual([
      'example-size-large',
      'example-size-large-2',
      'example-default',
      'example-size-large-3',
    ]);
    // A suffixed id never takes the plain id of a later story.
    expect(exampleAnchors(['A', 'A', 'A2'])).toEqual(['example-a', 'example-a-2', 'example-a2']);
    expect(exampleAnchors(['A2', 'A_2', 'A', 'A'])).toEqual([
      'example-a2',
      'example-a-2',
      'example-a',
      'example-a-3',
    ]);
  });

  it('exampleAnchor is a kebab id under example-', () => {
    expect(exampleAnchor('Default')).toBe('example-default');
    expect(exampleAnchor('WithIconAfter')).toBe('example-with-icon-after');
    expect(exampleAnchor('Size_Large2')).toBe('example-size-large2');
  });
});

describe('metaDescription', () => {
  it('is the first paragraph as plain text: wrapped lines joined, a code span without its backticks', () => {
    expect(metaDescription('A `Button` that\nwraps.\n\nSecond paragraph.')).toBe(
      'A Button that wraps.',
    );
  });

  it('keeps a short paragraph whole and has no text for an empty description', () => {
    expect(metaDescription('Short.')).toBe('Short.');
    expect(metaDescription('')).toBe('');
    expect(metaDescription('  \n\n ')).toBe('');
  });

  it('keeps whole sentences when the paragraph is longer than a search result shows', () => {
    const first = 'A first sentence that says what the component is for and how it behaves.';
    const second = 'A second sentence that goes on for quite a while and does not stop.';
    const text = `${first} ${second} ${'A third sentence that no longer fits in a result. '.repeat(2)}`;
    expect(metaDescription(text)).toBe(`${first} ${second}`);
  });

  it('cuts one long sentence at a word and marks the cut', () => {
    const text = `${'word '.repeat(60)}end.`;
    const result = metaDescription(text);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toMatch(/\s…$/);
    expect(text.startsWith(result.slice(0, -1))).toBe(true);
  });

  it('honours a limit of its own', () => {
    expect(metaDescription('One sentence here. And another one follows it.', 25)).toBe(
      'One sentence here.',
    );
  });
});
