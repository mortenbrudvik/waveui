import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Stack } from '../Stack';
import type { StackOwnProps, StackProps } from '../Stack';
import type { Orientation } from '../../../lib/types';
import { testSystemProps } from '../../../test-utils';

describe('Stack', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testSystemProps(Stack, {
    expectedTag: 'div',
    displayName: 'Stack',
    polymorphic: true,
    defaultProps: { children: <p>Stack item</p> },
    conflictingClass: { className: 'gap-8', overrides: 'gap-3' },
  });

  it('renders without crashing', () => {
    render(<Stack data-testid="stack">Content</Stack>);
    expect(screen.getByTestId('stack')).toHaveTextContent('Content');
  });

  it('renders children', () => {
    render(<Stack>Stack content</Stack>);
    expect(screen.getByText('Stack content')).toBeInTheDocument();
  });

  it('renders as vertical flex-col by default (exact tokens, feedback-navigation#21)', () => {
    render(<Stack data-testid="stack">Content</Stack>);
    const el = screen.getByTestId('stack');
    expect(el).toHaveClass('flex', 'flex-col');
    expect(el).not.toHaveClass('inline-flex');
    expect(el).not.toHaveClass('flex-row');
  });

  it('renders as horizontal flex-row when orientation is horizontal', () => {
    render(
      <Stack orientation="horizontal" data-testid="stack">
        Content
      </Stack>,
    );
    const el = screen.getByTestId('stack');
    expect(el).toHaveClass('flex-row');
    expect(el).not.toHaveClass('flex-col');
  });

  describe('deprecated `direction` alias (layout#16)', () => {
    it('still renders horizontally and warns once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <Stack direction="horizontal" data-testid="stack">
            Content
          </Stack>
          <Stack direction="horizontal">Content</Stack>
        </>,
      );
      expect(screen.getByTestId('stack')).toHaveClass('flex-row');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[WaveUI] Stack: `direction` is deprecated and will be removed in 1.0. Use `orientation` instead.',
      );
    });

    it('lets orientation win when both are given', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Stack orientation="vertical" direction="horizontal" data-testid="stack">
          Content
        </Stack>,
      );
      const el = screen.getByTestId('stack');
      expect(el).toHaveClass('flex-col');
      expect(el).not.toHaveClass('flex-row');
    });

    it('does not warn for orientation alone', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Stack orientation="horizontal">Content</Stack>);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('applies default md gap', () => {
    render(<Stack data-testid="stack">Content</Stack>);
    expect(screen.getByTestId('stack')).toHaveClass('gap-3');
  });

  it.each([
    ['none', 'gap-0'],
    ['xs', 'gap-1'],
    ['sm', 'gap-2'],
    ['lg', 'gap-4'],
    ['xl', 'gap-6'],
  ] as const)('applies %s gap', (gap, expected) => {
    render(
      <Stack gap={gap} data-testid="stack">
        Content
      </Stack>,
    );
    const el = screen.getByTestId('stack');
    expect(el).toHaveClass(expected);
    expect(el).not.toHaveClass('gap-3');
  });

  it('applies align prop', () => {
    render(
      <Stack align="center" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack')).toHaveClass('items-center');
  });

  it('applies justify prop', () => {
    render(
      <Stack justify="between" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack')).toHaveClass('justify-between');
  });

  it('applies wrap class when wrap is true', () => {
    render(
      <Stack wrap data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack')).toHaveClass('flex-wrap');
  });

  it('does not apply wrap class when wrap is false', () => {
    render(<Stack data-testid="stack">Content</Stack>);
    expect(screen.getByTestId('stack')).not.toHaveClass('flex-wrap');
  });

  it('applies inline-flex when inline is true', () => {
    render(
      <Stack inline data-testid="stack">
        Content
      </Stack>,
    );
    const el = screen.getByTestId('stack');
    expect(el).toHaveClass('inline-flex');
    expect(el).not.toHaveClass('flex');
  });

  it('renders as custom element via as prop', () => {
    render(
      <Stack as="section" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack').tagName.toLowerCase()).toBe('section');
  });

  describe('types (button-provider#8, #27, layout#16)', () => {
    it('type-checks props against the `as` element', () => {
      const listRef = React.createRef<HTMLOListElement>();
      render(
        <Stack as="ol" ref={listRef} start={3} aria-label="Steps">
          <li>Three</li>
        </Stack>,
      );
      expect(listRef.current).toHaveAttribute('start', '3');

      const elements = [
        // @ts-expect-error start does not exist on the default <div>
        <Stack key="1" start={3} />,
        // @ts-expect-error orientation is the shared Orientation type
        <Stack key="2" orientation="diagonal" />,
      ];
      expect(elements).toHaveLength(2);
    });

    it('StackProps (0.4 name) is the default-tag props type, extendable, with ref (C-REF)', () => {
      interface SectionStackProps extends StackProps {
        heading?: string;
      }
      const SectionStack = ({ heading, children, ...props }: SectionStackProps) => (
        <Stack {...props}>
          <h2>{heading}</h2>
          {children}
        </Stack>
      );
      const ref = React.createRef<HTMLDivElement>();
      render(<SectionStack ref={ref} heading="Details" data-testid="section" />);
      expect(ref.current).toBe(screen.getByTestId('section'));

      expectTypeOf<StackProps>().toEqualTypeOf<StackProps<'div'>>();
      expectTypeOf<StackProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
      expectTypeOf<StackOwnProps['orientation']>().toEqualTypeOf<Orientation | undefined>();
      expectTypeOf<StackOwnProps['direction']>().toEqualTypeOf<Orientation | undefined>();
    });
  });
});
