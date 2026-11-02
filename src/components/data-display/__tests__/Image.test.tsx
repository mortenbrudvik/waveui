import type * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Image } from '../Image';
import type { ImageFit, ImageProps, ImageShape, StrictImageProps } from '../Image';
import { hasWarned } from '../../../lib/dev';
import type { Shape } from '../../../lib/types';
import { testSystemProps } from '../../../test-utils';

describe('Image', () => {
  testSystemProps(Image, {
    expectedTag: 'img',
    displayName: 'Image',
    defaultProps: { src: 'test.png', alt: 'Test image' },
    conflictingClass: { className: 'rounded-lg', overrides: 'wave:rounded-none' },
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

  it('does not default the alt attribute for untyped code that leaves it out', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // @ts-expect-error alt is required (1.0)
      render(<Image src="photo.jpg" data-testid="img" />);
      expect(screen.getByTestId('img')).not.toHaveAttribute('alt');
      // The expected warning, and nothing else.
      expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
        expect.stringMatching(/^\[WaveUI\] Image: `alt` is required/),
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  // data-display#28
  describe('alt text', () => {
    it('warns once in development when untyped code leaves alt out (1.0: no "in 1.0" notice)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        // @ts-expect-error alt is required (1.0)
        render(<Image src="a.png" />);
        render(<Image {...({ src: 'b.png' } as ImageProps)} />);
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] Image: `alt` is required. Describe the image, or pass alt="" when it is decorative.',
          ],
        ]);
        expect(hasWarned('Image:alt-missing')).toBe(true);
        // Not the key of the 0.18 notice, which 1.0 retires.
        expect(hasWarned('Image:alt')).toBe(false);
      } finally {
        warn.mockRestore();
      }
    });

    it('logs nothing in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(<Image {...({ src: 'a.png' } as ImageProps)} />);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
        vi.unstubAllEnvs();
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

    it('requires alt on ImageProps (1.0); StrictImageProps is the same type', () => {
      expectTypeOf<ImageProps['alt']>().toEqualTypeOf<string>();
      expectTypeOf<StrictImageProps>().toEqualTypeOf<ImageProps>();
      // @ts-expect-error alt is required
      const missing: ImageProps = { src: 'a.png' };
      // @ts-expect-error StrictImageProps requires alt too
      const missingStrict: StrictImageProps = { src: 'a.png' };
      // @ts-expect-error alt takes a string, never undefined
      const undefinedAlt: ImageProps = { src: 'a.png', alt: undefined };
      const decorative: ImageProps = { src: 'a.png', alt: '' };
      const asStrict: StrictImageProps = decorative;
      expect([missing, missingStrict, undefinedAlt, asStrict]).toHaveLength(4);
      const elements = [
        // @ts-expect-error alt is required on the element too
        <Image key="missing" src="a.png" />,
        <Image key="decorative" src="a.png" alt="" />,
        <Image key="described" src="a.png" alt="A photo" />,
      ];
      expect(elements).toHaveLength(3);
    });
  });

  // layout#16
  it('uses the shared Shape type', () => {
    expectTypeOf<ImageShape>().toEqualTypeOf<Shape>();
    expectTypeOf<ImageProps['shape']>().toEqualTypeOf<Shape | undefined>();
  });

  // data-display#16: `none` keeps the image's top-left corner in
  // view, `center` its middle (the initial object-position), so the two values differ.
  it.each([
    ['none', ['wave:object-none', 'wave:object-left-top']],
    ['center', ['wave:object-none', 'wave:object-center']],
    ['contain', ['wave:object-contain']],
    ['cover', ['wave:object-cover']],
  ] as Array<[ImageFit, string[]]>)('fit %s applies %j', (fit, classes) => {
    render(<Image fit={fit} src="test.png" alt="" data-testid="img" />);
    const img = screen.getByTestId('img');
    expect(img).toHaveClass(...classes);
    const positions = Array.from(img.classList).filter((cls) =>
      /^wave:object-(center|left|right|top|bottom)/.test(cls),
    );
    expect(positions).toHaveLength(fit === 'none' || fit === 'center' ? 1 : 0);
  });

  it('applies no object-fit class for the default fit', () => {
    render(<Image src="test.png" alt="" data-testid="img" />);
    expect(screen.getByTestId('img').className).not.toMatch(/\bobject-/);
  });

  it.each([
    ['circular', 'wave:rounded-full'],
    ['rounded', 'wave:rounded'],
    ['square', 'wave:rounded-none'],
  ] as Array<[ImageShape, string]>)('shape %s applies %s', (shape, cls) => {
    render(<Image shape={shape} src="test.png" alt="" data-testid="img" />);
    expect(screen.getByTestId('img')).toHaveClass(cls);
  });

  it.each([
    ['shadow', { shadow: true }, ['wave:shadow-4']],
    ['block', { block: true }, ['wave:block', 'wave:w-full']],
    ['bordered', { bordered: true }, ['wave:border', 'wave:border-border']],
  ] as const)('applies %s', (_name, props, classes) => {
    render(<Image {...props} src="test.png" alt="" data-testid="img" />);
    expect(screen.getByTestId('img')).toHaveClass(...classes);
  });

  it('is inline-block unless block', () => {
    render(<Image src="test.png" alt="" data-testid="img" />);
    expect(screen.getByTestId('img')).toHaveClass('wave:inline-block');
    // One class per assertion: a multi-class `.not.toHaveClass` passes when any one is missing.
    expect(screen.getByTestId('img')).not.toHaveClass('wave:shadow-4');
    expect(screen.getByTestId('img')).not.toHaveClass('wave:border');
  });

  // C-NATIVE: Preflight is opt-in, so the image sets the sizing it relies
  // on. It never grows past its container, and with the default fit (the image fills its box) the
  // height follows the width, so `width`/`height` attributes keep the aspect ratio instead of
  // distorting it. Another fit fits the image into the box, whose height is then kept.
  describe('sizing', () => {
    it.each([
      ['inline', {}, ['wave:inline-block', 'wave:max-w-full', 'wave:h-auto']],
      ['block', { block: true }, ['wave:block', 'wave:w-full', 'wave:h-auto']],
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
        expect(img).toHaveClass('wave:block', 'wave:w-full');
        expect(img).not.toHaveClass('wave:h-auto');
      },
    );

    it('lets a className height replace the automatic height', () => {
      render(<Image block className="h-48" src="hero.jpg" alt="" data-testid="img" />);
      const img = screen.getByTestId('img');
      expect(img).toHaveClass('h-48');
      expect(img).not.toHaveClass('wave:h-auto');
    });
  });

  // repo-level#32: the story placeholder (literal #rrggbb paint, encoded exactly once) is checked
  // on the rendered story args in src/__tests__/integration.test.tsx.

  // button-provider#27 (C-REF): ref is declared in the props interface.
  it('declares ref in ImageProps (C-REF)', () => {
    expectTypeOf<ImageProps['ref']>().toEqualTypeOf<React.Ref<HTMLImageElement> | undefined>();
  });
});
