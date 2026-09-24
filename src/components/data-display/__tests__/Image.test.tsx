import type * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Image } from '../Image';
import type { ImageFit, ImageProps, ImageShape, StrictImageProps } from '../Image';
import type { Shape } from '../../../lib/types';
import imageStorySource from '../../../../stories/Image.stories.tsx?raw';
import { testSystemProps } from '../../../test-utils';

describe('Image', () => {
  testSystemProps(Image, {
    expectedTag: 'img',
    displayName: 'Image',
    defaultProps: { src: 'test.png', alt: 'Test image' },
    conflictingClass: { className: 'rounded-lg', overrides: 'rounded-none' },
    a11yVariants: [
      { name: 'decorative', props: { alt: '' } },
      { name: 'styled', props: { shape: 'circular', bordered: true, shadow: true, block: true } },
    ],
  });

  it('renders as img element', () => {
    render(<Image data-testid="img" src="test.png" alt="" />);
    expect(screen.getByTestId('img').tagName.toLowerCase()).toBe('img');
  });

  it('applies src and alt', () => {
    render(<Image src="photo.jpg" alt="A photo" />);
    expect(screen.getByRole('img', { name: 'A photo' })).toHaveAttribute('src', 'photo.jpg');
  });

  it('does not default the alt attribute', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(<Image src="photo.jpg" data-testid="img" />);
      expect(screen.getByTestId('img')).not.toHaveAttribute('alt');
    } finally {
      warn.mockRestore();
    }
  });

  // data-display#28
  describe('alt text', () => {
    it('warns once in development when alt is missing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(<Image src="a.png" />);
        render(<Image src="b.png" />);
        const calls = warn.mock.calls.filter(([message]) => String(message).includes('Image'));
        expect(calls).toHaveLength(1);
        expect(String(calls[0]![0])).toMatch(/^\[WaveUI\] Image: .*alt=""/);
      } finally {
        warn.mockRestore();
      }
    });

    it.each([
      ['an empty alt (decorative image)', ''],
      ['a description', 'A photo'],
    ])('does not warn for %s', (_name, alt) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(<Image src="a.png" alt={alt} />);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('keeps alt optional on ImageProps and requires it on StrictImageProps', () => {
      expectTypeOf<ImageProps['alt']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<StrictImageProps['alt']>().toEqualTypeOf<string>();
      // @ts-expect-error StrictImageProps requires alt
      const missing: StrictImageProps = { src: 'a.png' };
      const decorative: StrictImageProps = { src: 'a.png', alt: '' };
      const asImageProps: ImageProps = decorative;
      expect([missing, asImageProps]).toHaveLength(2);
    });
  });

  // layout#16
  it('uses the shared Shape type', () => {
    expectTypeOf<ImageShape>().toEqualTypeOf<Shape>();
    expectTypeOf<ImageProps['shape']>().toEqualTypeOf<Shape | undefined>();
  });

  // data-display#16
  it.each([
    ['none', ['object-none']],
    ['center', ['object-none', 'object-center']],
    ['contain', ['object-contain']],
    ['cover', ['object-cover']],
  ] as Array<[ImageFit, string[]]>)('fit %s applies %j', (fit, classes) => {
    render(<Image fit={fit} src="test.png" alt="" data-testid="img" />);
    expect(screen.getByTestId('img')).toHaveClass(...classes);
  });

  it('applies no object-fit class for the default fit', () => {
    render(<Image src="test.png" alt="" data-testid="img" />);
    expect(screen.getByTestId('img').className).not.toMatch(/\bobject-/);
  });

  it.each([
    ['circular', 'rounded-full'],
    ['rounded', 'rounded'],
    ['square', 'rounded-none'],
  ] as Array<[ImageShape, string]>)('shape %s applies %s', (shape, cls) => {
    render(<Image shape={shape} src="test.png" alt="" data-testid="img" />);
    expect(screen.getByTestId('img')).toHaveClass(cls);
  });

  it.each([
    ['shadow', { shadow: true }, ['shadow-4']],
    ['block', { block: true }, ['block', 'w-full']],
    ['bordered', { bordered: true }, ['border', 'border-border']],
  ] as const)('applies %s', (_name, props, classes) => {
    render(<Image {...props} src="test.png" alt="" data-testid="img" />);
    expect(screen.getByTestId('img')).toHaveClass(...classes);
  });

  it('is inline-block unless block', () => {
    render(<Image src="test.png" alt="" data-testid="img" />);
    expect(screen.getByTestId('img')).toHaveClass('inline-block');
    // One class per assertion: a multi-class `.not.toHaveClass` passes when any one is missing.
    expect(screen.getByTestId('img')).not.toHaveClass('shadow-4');
    expect(screen.getByTestId('img')).not.toHaveClass('border');
  });

  // repo-level#32: the story placeholder paints visible fills (the `#` is encoded exactly once).
  // The story is read as text: importing it would load the whole `../src` barrel, i.e. every other
  // package's in-flight module (§5.9).
  it('story placeholder writes literal "#" paint colors and encodes them exactly once', () => {
    const colors = Object.fromEntries(
      Array.from(imageStorySource.matchAll(/const (PLACEHOLDER_\w+) = '([^']*)';/g), (match) => [
        match[1],
        match[2],
      ]),
    );
    expect(colors).toEqual({
      PLACEHOLDER_FILL: expect.stringMatching(/^#[0-9a-f]{6}$/),
      PLACEHOLDER_TEXT: expect.stringMatching(/^#[0-9a-f]{6}$/),
    });
    expect(imageStorySource).not.toContain('%23');
    expect(imageStorySource.match(/encodeURIComponent\(/g)).toHaveLength(1);
    expect(imageStorySource).toMatch(/`data:image\/svg\+xml,\$\{encodeURIComponent\(/);
    expect(imageStorySource).toMatch(/<rect[^>]* fill="\$\{PLACEHOLDER_FILL\}"/);
    expect(imageStorySource).toMatch(/<text[^>]* fill="\$\{PLACEHOLDER_TEXT\}"/);
    expect(imageStorySource).toMatch(
      /export const Default: Story = \{\s*args: \{\s*src: placeholder\(/,
    );
  });

  // button-provider#27 (C-REF): ref is declared in the props interface.
  it('declares ref in ImageProps (C-REF)', () => {
    expectTypeOf<ImageProps['ref']>().toEqualTypeOf<React.Ref<HTMLImageElement> | undefined>();
  });
});
