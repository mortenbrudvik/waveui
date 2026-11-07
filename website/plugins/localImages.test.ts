import { describe, expect, it } from 'vitest';
import {
  AVATAR_IMAGE,
  EXTERNAL_IMAGE_HOST,
  localStoryImages,
  rewriteExternalImages,
} from './localImages.mjs';

const IDENT = '__waveuiLocalImage';

describe('rewriteExternalImages', () => {
  it('replaces each literal that starts with the host by one constant per file', () => {
    const source = [
      "import { Avatar } from '../src';",
      '',
      "export const A = { args: { src: 'https://i.pravatar.cc/150?u=a' } };",
      'export const B = { args: { src: "https://i.pravatar.cc/150?u=b" } };',
      'export const C = { args: { src: `https://i.pravatar.cc/150?u=c` } };',
      'export const D = (name: string) => `https://i.pravatar.cc/150?u=${name}`;',
      'export const E = () => <Avatar src="https://i.pravatar.cc/64" />;',
      '',
    ].join('\n');
    expect(rewriteExternalImages(source, 'x.stories.tsx')).toBe(
      [
        `const ${IDENT} = ${JSON.stringify(AVATAR_IMAGE)};`,
        "import { Avatar } from '../src';",
        '',
        `export const A = { args: { src: ${IDENT} } };`,
        `export const B = { args: { src: ${IDENT} } };`,
        `export const C = { args: { src: ${IDENT} } };`,
        `export const D = (name: string) => ${IDENT};`,
        `export const E = () => <Avatar src={${IDENT}} />;`,
        '',
      ].join('\n'),
    );
  });

  it('writes the image inline when asked (the code a page shows)', () => {
    const source = "export const A = { args: { src: 'https://i.pravatar.cc/150?u=a' } };";
    expect(rewriteExternalImages(source, 'snippet.tsx', { inline: true })).toBe(
      `export const A = { args: { src: '${AVATAR_IMAGE}' } };`,
    );
    expect(
      rewriteExternalImages('const e = <Avatar src="https://i.pravatar.cc/1" />;', 's.tsx', {
        inline: true,
      }),
    ).toBe(`const e = <Avatar src="${AVATAR_IMAGE}" />;`);
  });

  it('leaves every other string, comments and similar hosts untouched', () => {
    const source = [
      '// https://i.pravatar.cc/150 in a comment stays',
      "const a = 'http://i.pravatar.cc/150';",
      "const b = 'https://i.pravatar.cc.example.com/150';",
      "const c = 'https://example.com/https://i.pravatar.cc/150';",
      "const d = 'https://I.PRAVATAR.CC.invalid/';",
      "const e = 'data:image/png;base64,broken';",
      '',
    ].join('\n');
    expect(rewriteExternalImages(source, 'x.stories.tsx')).toBe(source);
  });

  it('is a small, deterministic SVG data URI with no other host and no quotes', () => {
    expect(EXTERNAL_IMAGE_HOST).toBe('https://i.pravatar.cc/');
    expect(AVATAR_IMAGE.startsWith('data:image/svg+xml,')).toBe(true);
    expect(AVATAR_IMAGE.length).toBeLessThan(400);
    expect(AVATAR_IMAGE).not.toMatch(/['"`\s<>#]/);
    const svg = decodeURIComponent(AVATAR_IMAGE.slice('data:image/svg+xml,'.length));
    expect(svg).toMatch(/^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg' [^>]*>.*<\/svg>$/);
    // The SVG namespace is a name, not a request; no other address appears.
    expect(svg.match(/https?:\/\/[^']+/g)).toEqual(['http://www.w3.org/2000/svg']);
  });
});

describe('localStoryImages (the Vite plugin)', () => {
  const plugin = localStoryImages({ storiesDir: '/repo/stories' });
  const transform = plugin.transform as (
    code: string,
    id: string,
  ) => { code: string; map: null } | undefined;
  const story = "export const A = { args: { src: 'https://i.pravatar.cc/1' } };\n";

  it('rewrites story files of the stories folder, in every environment', () => {
    expect(plugin.apply).toBeUndefined();
    expect(plugin.applyToEnvironment).toBeUndefined();
    expect(transform(story, '/repo/stories/Avatar.stories.tsx')!.code).toContain(IDENT);
    expect(transform(story, 'C:\\repo\\stories\\Avatar.stories.tsx')).toBeUndefined();
    const windows = localStoryImages({ storiesDir: 'C:\\repo\\stories' });
    const windowsTransform = windows.transform as typeof transform;
    expect(windowsTransform(story, 'C:/repo/stories/Avatar.stories.tsx')!.code).toContain(IDENT);
  });

  it('leaves other modules, and story files without the host, alone', () => {
    expect(transform(story, '/repo/src/components/Avatar.tsx')).toBeUndefined();
    expect(transform(story, '/repo/stories/_helpers.ts')).toBeUndefined();
    expect(transform('export const A = {};\n', '/repo/stories/A.stories.tsx')).toBeUndefined();
  });
});
