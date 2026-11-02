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
    conflictingClass: { className: 'gap-8', overrides: 'wave:gap-3' },
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
    expect(el).toHaveClass('wave:flex', 'wave:flex-col');
    expect(el).not.toHaveClass('wave:inline-flex');
    expect(el).not.toHaveClass('wave:flex-row');
  });

  it('renders as horizontal flex-row when orientation is horizontal', () => {
    render(
      <Stack orientation="horizontal" data-testid="stack">
        Content
      </Stack>,
    );
    const el = screen.getByTestId('stack');
    expect(el).toHaveClass('wave:flex-row');
    expect(el).not.toHaveClass('wave:flex-col');
  });

  describe('the 0.4 `direction` is removed in 1.0 (layout#16)', () => {
    // Untyped code that still passes it: an unknown attribute of the rendered element, which
    // React renders as it is, and the stack stays vertical.
    it('has no direction alias of orientation: the stack stays vertical', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(
        <Stack
          // @ts-expect-error -- `direction` is removed in 1.0: use `orientation`
          direction="horizontal"
          data-testid="stack"
        >
          Content
        </Stack>,
      );
      const el = screen.getByTestId('stack');
      expect(el).toHaveClass('wave:flex-col');
      expect(el).not.toHaveClass('wave:flex-row');
      expect(el).toHaveAttribute('direction', 'horizontal');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('does not warn for orientation', () => {
      const warn = vi.spyOn(console, 'warn');
      render(<Stack orientation="horizontal">Content</Stack>);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('applies default md gap', () => {
    render(<Stack data-testid="stack">Content</Stack>);
    expect(screen.getByTestId('stack')).toHaveClass('wave:gap-3');
  });

  it.each([
    ['none', 'wave:gap-0'],
    ['xs', 'wave:gap-1'],
    ['sm', 'wave:gap-2'],
    ['lg', 'wave:gap-4'],
    ['xl', 'wave:gap-6'],
  ] as const)('applies %s gap', (gap, expected) => {
    render(
      <Stack gap={gap} data-testid="stack">
        Content
      </Stack>,
    );
    const el = screen.getByTestId('stack');
    expect(el).toHaveClass(expected);
    expect(el).not.toHaveClass('wave:gap-3');
  });

  it('applies align prop', () => {
    render(
      <Stack align="center" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack')).toHaveClass('wave:items-center');
  });

  it('applies justify prop', () => {
    render(
      <Stack justify="between" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack')).toHaveClass('wave:justify-between');
  });

  it('applies wrap class when wrap is true', () => {
    render(
      <Stack wrap data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack')).toHaveClass('wave:flex-wrap');
  });

  it('does not apply wrap class when wrap is false', () => {
    render(<Stack data-testid="stack">Content</Stack>);
    expect(screen.getByTestId('stack')).not.toHaveClass('wave:flex-wrap');
  });

  it('applies inline-flex when inline is true', () => {
    render(
      <Stack inline data-testid="stack">
        Content
      </Stack>,
    );
    const el = screen.getByTestId('stack');
    expect(el).toHaveClass('wave:inline-flex');
    expect(el).not.toHaveClass('wave:flex');
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
      expectTypeOf<StackOwnProps>().not.toHaveProperty('direction');
    });
  });
});
