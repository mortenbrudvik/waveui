import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from '../Text';
import type { TextOwnProps, TextProps } from '../Text';
import { testSystemProps, renderWithProviders } from '../../../test-utils';
import type { TextWeight, TypographyVariant } from '../../../lib/types';

const VARIANTS: TypographyVariant[] = [
  'caption-2',
  'caption-1',
  'body-1',
  'body-2',
  'subtitle-2',
  'subtitle-1',
  'title-3',
  'title-2',
  'title-1',
  'large-title',
  'display',
];

/** Text color utilities (theme tokens and the Tailwind palette), not the type-ramp sizes. */
const isTextColorClass = (cls: string) =>
  /^text-(?!(caption|body|subtitle|title|large-title|display)(-|$))(?!(xs|sm|base|lg|[0-9]?xl)$)(?!(left|right|center|start|end|justify)$)/.test(
    cls,
  );

describe('Text', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The `as` variants render other elements, so the props are typed for any element.
  testSystemProps<TextProps<React.ElementType>>(Text, {
    expectedTag: 'span',
    displayName: 'Text',
    polymorphic: true,
    defaultProps: { children: 'The quick brown fox' },
    conflictingClass: { className: 'text-title-1', overrides: 'text-body-1' },
    a11yVariants: [
      { name: 'as heading', props: { as: 'h2', variant: 'title-2' } },
      { name: 'bold', props: { weight: 'bold' } },
    ],
  });

  it('renders its children in a span by default', () => {
    render(<Text>Hello World</Text>);
    const text = screen.getByText('Hello World');
    expect(text.tagName).toBe('SPAN');
  });

  it('renders as a different element via as prop', () => {
    render(
      <Text as="h1" variant="title-1">
        Page heading
      </Text>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Page heading' })).toHaveClass(
      'text-title-1',
    );
  });

  describe('variant (button-provider#16)', () => {
    it.each(VARIANTS)('variant %s applies text-%s', (variant) => {
      render(<Text variant={variant}>Content</Text>);
      const text = screen.getByText('Content');
      expect(text).toHaveClass(`text-${variant}`);
      const otherVariants = VARIANTS.filter((v) => v !== variant).map((v) => `text-${v}`);
      expect(Array.from(text.classList).filter((c) => otherVariants.includes(c))).toEqual([]);
    });

    it('defaults to body-1', () => {
      render(<Text>Content</Text>);
      expect(screen.getByText('Content')).toHaveClass('text-body-1');
    });

    it('keeps the variant next to a color className (table-core#1)', () => {
      render(
        <Text variant="body-1" className="text-primary">
          Content
        </Text>,
      );
      expect(screen.getByText('Content')).toHaveClass('text-body-1', 'text-primary');
    });

    it('keeps the variant next to a muted color className', () => {
      render(
        <Text variant="caption-1" className="text-muted-foreground">
          Content
        </Text>,
      );
      expect(screen.getByText('Content')).toHaveClass('text-caption-1', 'text-muted-foreground');
    });

    it('a font-size className wins over the variant', () => {
      render(<Text className="text-sm">Content</Text>);
      const text = screen.getByText('Content');
      expect(text).toHaveClass('text-sm');
      expect(text).not.toHaveClass('text-body-1');
    });
  });

  describe('color (button-provider#2)', () => {
    it('has no text color of its own, so it inherits the provider foreground', () => {
      const { container } = renderWithProviders(<Text>Dark theme text</Text>, { theme: 'dark' });
      const text = screen.getByText('Dark theme text');
      expect(Array.from(text.classList).filter(isTextColorClass)).toEqual([]);
      const root = container.querySelector('.wave-root');
      expect(root).toHaveClass('wave-dark', 'text-foreground');
      expect(root).toContainElement(text);
    });
  });

  describe('weight (layout#16)', () => {
    const weights: Array<[TextWeight, string]> = [
      ['regular', 'font-normal'],
      ['semibold', 'font-semibold'],
      ['bold', 'font-bold'],
    ];

    it.each(weights)('weight "%s" applies %s', (weight, cls) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Text weight={weight}>Content</Text>);
      expect(screen.getByText('Content')).toHaveClass(cls);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      [400, 'regular', 'font-normal'],
      [600, 'semibold', 'font-semibold'],
      [700, 'bold', 'font-bold'],
    ] as const)(
      'the deprecated numeric weight %s still applies and warns once (use "%s")',
      (numeric, name, cls) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { rerender } = render(<Text weight={numeric}>Content</Text>);
        rerender(<Text weight={numeric}>Content again</Text>);
        expect(screen.getByText('Content again')).toHaveClass(cls);
        const messages = warn.mock.calls.map((call) => String(call[0]));
        expect(messages).toEqual([
          `[WaveUI] Text: \`weight={${numeric}}\` is deprecated and will be removed in 1.0. Use \`weight="${name}"\` instead.`,
        ]);
      },
    );

    it('does not apply a weight class when weight is not provided', () => {
      render(<Text>No weight</Text>);
      const text = screen.getByText('No weight');
      expect(text).not.toHaveClass('font-normal');
      expect(text).not.toHaveClass('font-semibold');
      expect(text).not.toHaveClass('font-bold');
    });
  });

  describe('types (button-provider#8, #27, layout#16)', () => {
    it('is polymorphic: props follow `as`', () => {
      const labelRef = React.createRef<HTMLLabelElement>();
      render(
        <>
          <Text as="label" htmlFor="name" ref={labelRef}>
            Name
          </Text>
          <input id="name" />
        </>,
      );
      expect(labelRef.current?.tagName).toBe('LABEL');
      expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();

      const elements = [
        <Text key="1" as="a" href="/docs" />,
        // @ts-expect-error href does not exist on <span>
        <Text key="2" href="/nope" />,
        // @ts-expect-error weight uses the TextWeight vocabulary (or the deprecated 400/600/700)
        <Text key="3" weight={500} />,
        // @ts-expect-error variant keeps its literal type
        <Text key="4" variant="headline" />,
      ];
      expect(elements).toHaveLength(4);
    });

    it('TextProps (0.4 name) is the default-tag props type, extendable, with ref (C-REF)', () => {
      interface MyTextProps extends TextProps {
        extra?: string;
      }
      expectTypeOf<MyTextProps>().toHaveProperty('variant');
      expectTypeOf<MyTextProps>().toHaveProperty('extra');
      expectTypeOf<TextProps>().toEqualTypeOf<TextProps<'span'>>();
      expectTypeOf<TextProps['ref']>().toEqualTypeOf<React.Ref<HTMLSpanElement> | undefined>();
      expectTypeOf<keyof TextOwnProps>().toEqualTypeOf<'variant' | 'weight'>();
      expectTypeOf<TextWeight>().toMatchTypeOf<NonNullable<TextOwnProps['weight']>>();
    });
  });
});
