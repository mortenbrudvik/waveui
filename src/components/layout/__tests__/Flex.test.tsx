import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { FOCUSABLE_SELECTOR } from '../../../lib/focus';
import { Flex } from '../Flex';
import type { FlexOwnProps, FlexProps } from '../Flex';
import { testSystemProps } from '../../../test-utils';

describe('Flex', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testSystemProps(Flex, {
    expectedTag: 'div',
    displayName: 'Flex',
    polymorphic: true,
    defaultProps: { children: <p>Flex item</p> },
    conflictingClass: { className: 'flex-col', overrides: 'flex-row' },
  });

  it('renders without crashing', () => {
    render(<Flex data-testid="flex">Content</Flex>);
    expect(screen.getByTestId('flex')).toHaveTextContent('Content');
  });

  it('renders children', () => {
    render(<Flex>Flex content</Flex>);
    expect(screen.getByText('Flex content')).toBeInTheDocument();
  });

  it('renders as flex-row by default (exact tokens, feedback-navigation#21)', () => {
    render(<Flex data-testid="flex">Content</Flex>);
    const el = screen.getByTestId('flex');
    expect(el).toHaveClass('flex', 'flex-row');
    expect(el).not.toHaveClass('inline-flex');
    expect(el).not.toHaveClass('flex-row-reverse');
  });

  it('applies row-reverse direction', () => {
    render(
      <Flex direction="row-reverse" data-testid="flex">
        Content
      </Flex>,
    );
    const el = screen.getByTestId('flex');
    expect(el).toHaveClass('flex-row-reverse');
    expect(el).not.toHaveClass('flex-row');
  });

  it('applies column direction', () => {
    render(
      <Flex direction="column" data-testid="flex">
        Content
      </Flex>,
    );
    const el = screen.getByTestId('flex');
    expect(el).toHaveClass('flex-col');
    expect(el).not.toHaveClass('flex-row');
  });

  it('applies column-reverse direction', () => {
    render(
      <Flex direction="column-reverse" data-testid="flex">
        Content
      </Flex>,
    );
    const el = screen.getByTestId('flex');
    expect(el).toHaveClass('flex-col-reverse');
    expect(el).not.toHaveClass('flex-col');
  });

  it('applies wrap class', () => {
    render(
      <Flex wrap="wrap" data-testid="flex">
        Content
      </Flex>,
    );
    const el = screen.getByTestId('flex');
    expect(el).toHaveClass('flex-wrap');
    expect(el).not.toHaveClass('flex-wrap-reverse');
  });

  it('applies nowrap class', () => {
    render(
      <Flex wrap="nowrap" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex')).toHaveClass('flex-nowrap');
  });

  it('applies wrap-reverse class', () => {
    render(
      <Flex wrap="wrap-reverse" data-testid="flex">
        Content
      </Flex>,
    );
    const el = screen.getByTestId('flex');
    expect(el).toHaveClass('flex-wrap-reverse');
    expect(el).not.toHaveClass('flex-wrap');
  });

  it('applies align prop', () => {
    render(
      <Flex align="center" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex')).toHaveClass('items-center');
  });

  it('applies align baseline', () => {
    render(
      <Flex align="baseline" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex')).toHaveClass('items-baseline');
  });

  it('applies justify prop', () => {
    render(
      <Flex justify="between" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex')).toHaveClass('justify-between');
  });

  it('applies gap prop', () => {
    render(
      <Flex gap="lg" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex')).toHaveClass('gap-4');
  });

  it('does not apply gap class when gap is not specified', () => {
    render(<Flex data-testid="flex">Content</Flex>);
    expect(screen.getByTestId('flex').className).not.toMatch(/gap-/);
  });

  it('applies inline-flex when inline is true', () => {
    render(
      <Flex inline data-testid="flex">
        Content
      </Flex>,
    );
    const el = screen.getByTestId('flex');
    expect(el).toHaveClass('inline-flex');
    expect(el).not.toHaveClass('flex');
  });

  it('applies grow class when grow is true', () => {
    render(
      <Flex grow data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex')).toHaveClass('grow');
  });

  describe('shrink (layout#39)', () => {
    it('shrink={true} emits the explicit shrink class', () => {
      render(
        <Flex shrink data-testid="flex">
          Content
        </Flex>,
      );
      const el = screen.getByTestId('flex');
      expect(el).toHaveClass('shrink');
      expect(el).not.toHaveClass('shrink-0');
    });

    it('shrink={false} emits shrink-0', () => {
      render(
        <Flex shrink={false} data-testid="flex">
          Content
        </Flex>,
      );
      const el = screen.getByTestId('flex');
      expect(el).toHaveClass('shrink-0');
      expect(el).not.toHaveClass('shrink');
    });

    it('emits neither class when shrink is not set', () => {
      render(<Flex data-testid="flex">Content</Flex>);
      const el = screen.getByTestId('flex');
      expect(el).not.toHaveClass('shrink');
      expect(el).not.toHaveClass('shrink-0');
    });
  });

  describe('reverse order with focusable content (layout#40)', () => {
    const REVERSE_WARNING =
      '[WaveUI] Flex: a reversed direction or wrap (`row-reverse`, `column-reverse`, `wrap-reverse`) changes the visual order only, so keyboard and screen-reader order run opposite to what users see. Reorder the DOM for focusable content instead.';
    /** Every message the `console.warn` spy received (nothing else may be logged, R14). */
    const reverseMessages = (warn: { mock: { calls: unknown[][] } }) =>
      warn.mock.calls.map((call) => String(call[0]));

    it.each([
      ['direction="row-reverse"', { direction: 'row-reverse' }],
      ['direction="column-reverse"', { direction: 'column-reverse' }],
      ['wrap="wrap-reverse"', { wrap: 'wrap-reverse' }],
    ] as const)('warns once in development for %s with focusable children', (_, props) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Flex {...props}>
          <button type="button">First</button>
          <button type="button">Second</button>
        </Flex>,
      );
      expect(reverseMessages(warn)).toEqual([REVERSE_WARNING]);
    });

    it('does not warn for reversed static content', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Flex direction="row-reverse">
          <span>First</span>
          <span>Second</span>
        </Flex>,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('does not warn for a forward direction with focusable content', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Flex direction="column" wrap="wrap">
          <button type="button">First</button>
        </Flex>,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('skips the focusable-content scan once the warning has fired', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const querySelectorAll = vi.spyOn(Element.prototype, 'querySelectorAll');
      const scans = () =>
        querySelectorAll.mock.calls.filter(([selector]) => selector === FOCUSABLE_SELECTOR).length;
      const rows = (gap: 'sm' | 'md') => (
        <>
          <Flex direction="row-reverse" gap={gap}>
            <button type="button">First</button>
          </Flex>
          <Flex direction="row-reverse" gap={gap}>
            <button type="button">Second</button>
          </Flex>
        </>
      );
      const { rerender } = render(rows('sm'));
      // The first Flex scans and warns; the second one already skips.
      expect(scans()).toBe(1);
      querySelectorAll.mockClear();
      rerender(rows('md'));
      expect(scans()).toBe(0);
      expect(reverseMessages(warn)).toEqual([REVERSE_WARNING]);
    });

    it('warns when focusable content appears later', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = render(
        <Flex direction="row-reverse">
          <span>Loading</span>
        </Flex>,
      );
      expect(reverseMessages(warn)).toHaveLength(0);
      rerender(
        <Flex direction="row-reverse">
          <a href="#next">Next</a>
        </Flex>,
      );
      expect(reverseMessages(warn)).toEqual([REVERSE_WARNING]);
    });
  });

  it('renders as custom element via as prop', () => {
    render(
      <Flex as="nav" aria-label="Sections" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBe(screen.getByTestId('flex'));
  });

  describe('types (button-provider#8, #27)', () => {
    it('type-checks props against the `as` element', () => {
      const listRef = React.createRef<HTMLUListElement>();
      render(
        <Flex as="ul" ref={listRef} aria-label="Items">
          <li>One</li>
        </Flex>,
      );
      expect(listRef.current).toBe(screen.getByRole('list', { name: 'Items' }));

      const elements = [
        // @ts-expect-error href does not exist on the default <div>
        <Flex key="1" href="/nope" />,
        // @ts-expect-error direction keeps its literal type
        <Flex key="2" direction="diagonal" />,
        // @ts-expect-error shrink is a boolean
        <Flex key="3" shrink="0" />,
      ];
      expect(elements).toHaveLength(3);
    });

    it('FlexProps (0.4 name) is the default-tag props type, extendable, with ref (C-REF)', () => {
      interface ToolbarRowProps extends FlexProps {
        compact?: boolean;
      }
      const ToolbarRow = ({ compact, ...props }: ToolbarRowProps) => (
        <Flex gap={compact ? 'xs' : 'md'} {...props} />
      );
      const ref = React.createRef<HTMLDivElement>();
      render(<ToolbarRow ref={ref} compact data-testid="row" />);
      expect(ref.current).toBe(screen.getByTestId('row'));

      expectTypeOf<FlexProps>().toEqualTypeOf<FlexProps<'div'>>();
      expectTypeOf<FlexProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
      expectTypeOf<keyof FlexOwnProps>().toEqualTypeOf<
        'direction' | 'wrap' | 'align' | 'justify' | 'gap' | 'inline' | 'grow' | 'shrink'
      >();
    });
  });
});
