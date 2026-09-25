import type * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Image } from '../Image';
import type { ImageFit, ImageProps, ImageShape, StrictImageProps } from '../Image';
import type { Shape } from '../../../lib/types';
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
      // data-display-a-tests-7: the expected warning, and nothing else.
      expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
        expect.stringMatching(/^\[WaveUI\] Image: `alt` is missing/),
      ]);
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
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] Image: `alt` is missing. Describe the image, or pass alt="" when it is decorative.',
          ],
        ]);
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

  // data-display#16; data-display-a-code-5 / docs-2: `none` keeps the image's top-left corner in
  // view, `center` its middle (the initial object-position), so the two values differ.
  it.each([
    ['none', ['object-none', 'object-left-top']],
    ['center', ['object-none', 'object-center']],
    ['contain', ['object-contain']],
    ['cover', ['object-cover']],
  ] as Array<[ImageFit, string[]]>)('fit %s applies %j', (fit, classes) => {
    render(<Image fit={fit} src="test.png" alt="" data-testid="img" />);
    const img = screen.getByTestId('img');
    expect(img).toHaveClass(...classes);
    const positions = Array.from(img.classList).filter((cls) =>
      /^object-(center|left|right|top|bottom)/.test(cls),
    );
    expect(positions).toHaveLength(fit === 'none' || fit === 'center' ? 1 : 0);
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

  // data-display-a-code-3 (C-NATIVE): Preflight is opt-in, so the image sets the sizing it relies
  // on. It never grows past its container, and with the default fit (the image fills its box) the
  // height follows the width, so `width`/`height` attributes keep the aspect ratio instead of
  // distorting it. Another fit fits the image into the box, whose height is then kept.
  describe('sizing', () => {
    it.each([
      ['inline', {}, ['inline-block', 'max-w-full', 'h-auto']],
      ['block', { block: true }, ['block', 'w-full', 'h-auto']],
    ] as Array<[string, Partial<ImageProps>, string[]]>)(
      'keeps the aspect ratio of a default-fit %s image',
      (_case, props, classes) => {
        render(
          <Image {...props} src="hero.jpg" width={1200} height={400} alt="" data-testid="img" />,
        );
        expect(screen.getByTestId('img')).toHaveClass(...classes);
      },
    );

    it.each(['none', 'center', 'contain', 'cover'] as ImageFit[])(
      'keeps the box height for fit %s',
      (fit) => {
        render(<Image block fit={fit} src="hero.jpg" height={300} alt="" data-testid="img" />);
        const img = screen.getByTestId('img');
        expect(img).toHaveClass('block', 'w-full');
        expect(img).not.toHaveClass('h-auto');
      },
    );

    it('lets a className height replace the automatic height', () => {
      render(<Image block className="h-48" src="hero.jpg" alt="" data-testid="img" />);
      const img = screen.getByTestId('img');
      expect(img).toHaveClass('h-48');
      expect(img).not.toHaveClass('h-auto');
    });
  });

  // repo-level#32: the story placeholder (literal #rrggbb paint, encoded exactly once) is checked
  // on the rendered story args in src/__tests__/integration.test.tsx.

  // button-provider#27 (C-REF): ref is declared in the props interface.
  it('declares ref in ImageProps (C-REF)', () => {
    expectTypeOf<ImageProps['ref']>().toEqualTypeOf<React.Ref<HTMLImageElement> | undefined>();
  });
});
