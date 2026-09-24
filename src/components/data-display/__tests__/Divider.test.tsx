import { describe, it, expect, expectTypeOf } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Divider } from '../Divider';
import type { DividerOwnProps, DividerProps } from '../Divider';
import type { Orientation } from '../../../lib/types';
import { renderWithProviders, testSystemProps } from '../../../test-utils';

describe('Divider', () => {
  testSystemProps(Divider, {
    expectedTag: 'hr',
    displayName: 'Divider',
    polymorphic: true,
    a11yVariants: [
      { name: 'labelled', props: { children: 'OR' } },
      { name: 'vertical', props: { orientation: 'vertical' } },
      { name: 'vertical labelled', props: { orientation: 'vertical', children: 'OR' } },
    ],
  });

  it('renders as a separator hr by default (horizontal, no children)', () => {
    render(<Divider data-testid="divider" />);
    const divider = screen.getByTestId('divider');
    expect(divider.tagName.toLowerCase()).toBe('hr');
    expect(screen.getByRole('separator')).toBe(divider);
    expect(divider).toHaveClass('border-t', 'border-border');
  });

  it('renders children text between lines', () => {
    render(<Divider>OR</Divider>);
    expect(screen.getByRole('separator', { name: 'OR' })).toHaveTextContent('OR');
  });

  it('renders as div when children are provided', () => {
    render(<Divider data-testid="divider">OR</Divider>);
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('div');
  });

  it('renders vertical orientation', () => {
    render(<Divider orientation="vertical" data-testid="divider" />);
    const el = screen.getByTestId('divider');
    expect(el).toHaveAttribute('role', 'separator');
    expect(el).toHaveAttribute('aria-orientation', 'vertical');
    expect(el).toHaveClass('border-s', 'border-border');
  });

  it('renders as custom element via as prop', () => {
    render(<Divider as="section" data-testid="divider" />);
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('section');
  });

  it('renders as custom element with children', () => {
    render(
      <Divider as="section" data-testid="divider">
        Text
      </Divider>,
    );
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('section');
  });

  it('renders as custom element in vertical mode', () => {
    render(<Divider as="span" orientation="vertical" data-testid="divider" />);
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('span');
  });

  describe('labelled divider (data-display#12)', () => {
    it('is a single separator named by its label, with presentational lines', () => {
      render(<Divider>OR</Divider>);
      const separators = screen.getAllByRole('separator');
      expect(separators).toHaveLength(1);
      const separator = screen.getByRole('separator', { name: 'OR' });
      expect(separator).toBe(separators[0]);
      expect(separator.querySelector('hr')).toBeNull();
      const lines = separator.querySelectorAll('[aria-hidden="true"]');
      expect(lines).toHaveLength(2);
      for (const line of lines) {
        expect(line.tagName.toLowerCase()).toBe('div');
        expect(line).toHaveClass('border-t');
      }
    });

    it('lets a consumer aria-label name the separator instead of the label', () => {
      render(<Divider aria-label="Alternative sign-in">OR</Divider>);
      expect(screen.getByRole('separator', { name: 'Alternative sign-in' })).toBeInTheDocument();
    });

    it('joins a consumer aria-labelledby with the label', () => {
      render(
        <>
          <span id="section-name">Options</span>
          <Divider aria-labelledby="section-name">OR</Divider>
        </>,
      );
      expect(screen.getByRole('separator', { name: 'Options OR' })).toBeInTheDocument();
    });
  });

  describe('vertical divider with children (data-display#11)', () => {
    it('renders the label between two vertical line segments', () => {
      render(<Divider orientation="vertical">OR</Divider>);
      const separator = screen.getByRole('separator', { name: 'OR' });
      expect(separator).toHaveAttribute('aria-orientation', 'vertical');
      expect(separator).toHaveClass('flex-col');
      expect(separator).toHaveTextContent('OR');
      const lines = separator.querySelectorAll('[aria-hidden="true"]');
      expect(lines).toHaveLength(2);
      for (const line of lines) expect(line).toHaveClass('border-s');
      expect(screen.getAllByRole('separator')).toHaveLength(1);
    });
  });

  // data-display-a-tests-3: a consumer aria-labelledby names the unlabelled separators too.
  it.each([
    ['plain', {}, 'HR'],
    ['vertical', { orientation: 'vertical' }, 'DIV'],
  ] as Array<[string, DividerProps, string]>)(
    'names the %s separator with a consumer aria-labelledby',
    (_case, props, tagName) => {
      render(
        <>
          <span id="section-title">Options</span>
          <Divider {...props} aria-labelledby="section-title" />
        </>,
      );
      expect(screen.getByRole('separator', { name: 'Options' }).tagName).toBe(tagName);
    },
  );

  // data-display-a-docs-3 / x-types-components-3 (R11): children that render nothing (an empty
  // `.map()` result) are no label: the divider stays a plain, unnamed separator.
  describe.each([
    ['an empty array', () => []],
    ['an array of empty items', () => [null, false, '', [undefined]]],
    ['a Set of empty items', () => new Set([null, ''])],
    [
      'a generator of empty items',
      function* emptyItems() {
        yield null;
        yield false;
      },
    ],
  ] as Array<[string, () => React.ReactNode]>)('children set to %s', (_kind, makeChildren) => {
    it('renders the plain horizontal rule', () => {
      render(<Divider data-testid="divider">{makeChildren()}</Divider>);
      const divider = screen.getByTestId('divider');
      expect(divider.tagName).toBe('HR');
      expect(divider).not.toHaveAttribute('aria-labelledby');
      expect(screen.getByRole('separator')).toBe(divider);
    });

    it('renders the plain vertical line', () => {
      render(
        <Divider orientation="vertical" data-testid="divider">
          {makeChildren()}
        </Divider>,
      );
      const divider = screen.getByTestId('divider');
      expect(divider).toHaveClass('inline-block', 'h-6');
      expect(divider).toBeEmptyDOMElement();
      expect(divider).not.toHaveAttribute('aria-labelledby');
    });
  });

  it.each([
    ['0', () => 0, '0'],
    ['an array with a label', () => [null, 'OR'], 'OR'],
    [
      'a generator with a label',
      function* label() {
        yield null;
        yield 'OR';
      },
      'OR',
    ],
  ] as Array<[string, () => React.ReactNode, string]>)(
    'renders %s as the label',
    (_kind, makeChildren, name) => {
      render(<Divider>{makeChildren()}</Divider>);
      expect(screen.getByRole('separator', { name })).toHaveTextContent(name);
    },
  );

  it('uses logical borders, so a vertical divider is RTL-safe (feedback-navigation#34)', () => {
    renderWithProviders(<Divider orientation="vertical" data-testid="divider" />, { dir: 'rtl' });
    const divider = screen.getByTestId('divider');
    expect(divider).toHaveClass('border-s');
    expect(divider.className).not.toMatch(/\bborder-[lr]\b/);
  });

  describe('types (button-provider#8, layout#16)', () => {
    it('type-checks props against the `as` element', () => {
      const anchorRef = React.createRef<HTMLAnchorElement>();
      const elementRef = React.createRef<HTMLElement>();
      render(
        <>
          <Divider ref={elementRef} />
          <Divider as="a" href="/more" ref={anchorRef}>
            More
          </Divider>
        </>,
      );
      expect(elementRef.current?.tagName.toLowerCase()).toBe('hr');
      expect(anchorRef.current).toBe(screen.getByRole('separator', { name: 'More' }));
    });

    it('rejects props the rendered element does not have', () => {
      const elements = [
        // @ts-expect-error href is not an <hr> attribute
        <Divider key="1" href="/nope" />,
        // @ts-expect-error orientation keeps its literal type
        <Divider key="2" orientation="diagonal" />,
      ];
      expect(elements).toHaveLength(2);
    });

    it('exports DividerOwnProps and the 0.4 DividerProps name', () => {
      expectTypeOf<DividerOwnProps['orientation']>().toEqualTypeOf<Orientation | undefined>();
      expectTypeOf<DividerProps>().toEqualTypeOf<DividerProps<'hr'>>();
      expectTypeOf<DividerProps>().toHaveProperty('ref');
      interface SectionDividerProps extends DividerProps {
        tracking?: string;
      }
      expectTypeOf<SectionDividerProps>().toHaveProperty('orientation');
    });
  });
});
