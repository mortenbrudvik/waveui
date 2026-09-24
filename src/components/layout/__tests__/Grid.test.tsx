import { describe, it, expect, expectTypeOf } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Grid } from '../Grid';
import type { GridOwnProps, GridProps } from '../Grid';
import { testSystemProps } from '../../../test-utils';

describe('Grid', () => {
  testSystemProps(Grid, {
    expectedTag: 'div',
    displayName: 'Grid',
    polymorphic: true,
    defaultProps: { columns: 2, gap: 'md', children: <p>Grid item</p> },
    conflictingClass: { className: 'grid-cols-4', overrides: 'grid-cols-2' },
  });

  it('renders without crashing', () => {
    render(<Grid data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid')).toHaveTextContent('Content');
  });

  it('renders children', () => {
    render(<Grid>Grid content</Grid>);
    expect(screen.getByText('Grid content')).toBeInTheDocument();
  });

  it('renders as a grid by default (exact token)', () => {
    render(<Grid data-testid="grid">Content</Grid>);
    const el = screen.getByTestId('grid');
    expect(el).toHaveClass('grid');
    expect(el).not.toHaveClass('inline-grid');
  });

  it('applies 1 column', () => {
    render(
      <Grid columns={1} data-testid="grid">
        Content
      </Grid>,
    );
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-1');
  });

  it('applies 2 columns', () => {
    render(
      <Grid columns={2} data-testid="grid">
        Content
      </Grid>,
    );
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-2');
  });

  it('applies 3 columns', () => {
    render(
      <Grid columns={3} data-testid="grid">
        Content
      </Grid>,
    );
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-3');
  });

  it('applies 4 columns', () => {
    render(
      <Grid columns={4} data-testid="grid">
        Content
      </Grid>,
    );
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-4');
  });

  it('applies 6 columns', () => {
    render(
      <Grid columns={6} data-testid="grid">
        Content
      </Grid>,
    );
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-6');
  });

  it('applies 12 columns', () => {
    render(
      <Grid columns={12} data-testid="grid">
        Content
      </Grid>,
    );
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-12');
  });

  it('applies rows via inline style', () => {
    render(
      <Grid rows={3} data-testid="grid">
        Content
      </Grid>,
    );
    const el = screen.getByTestId('grid');
    expect(el.style.gridTemplateRows).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('applies gap prop', () => {
    render(
      <Grid gap="lg" data-testid="grid">
        Content
      </Grid>,
    );
    expect(screen.getByTestId('grid')).toHaveClass('gap-4');
  });

  it('applies columnGap prop', () => {
    render(
      <Grid columnGap="sm" data-testid="grid">
        Content
      </Grid>,
    );
    expect(screen.getByTestId('grid')).toHaveClass('gap-x-2');
  });

  it('applies rowGap prop', () => {
    render(
      <Grid rowGap="xl" data-testid="grid">
        Content
      </Grid>,
    );
    expect(screen.getByTestId('grid')).toHaveClass('gap-y-6');
  });

  it('applies align prop', () => {
    render(
      <Grid align="center" data-testid="grid">
        Content
      </Grid>,
    );
    expect(screen.getByTestId('grid')).toHaveClass('items-center');
  });

  it('applies justify prop', () => {
    render(
      <Grid justify="center" data-testid="grid">
        Content
      </Grid>,
    );
    expect(screen.getByTestId('grid')).toHaveClass('justify-items-center');
  });

  it('renders as custom element via as prop', () => {
    render(
      <Grid as="section" data-testid="grid">
        Content
      </Grid>,
    );
    expect(screen.getByTestId('grid').tagName.toLowerCase()).toBe('section');
  });

  it('does not apply column class when columns is not specified', () => {
    render(<Grid data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).not.toMatch(/grid-cols-/);
  });

  it('merges the rows template with a consumer style', () => {
    render(
      <Grid rows={2} style={{ minHeight: 100 }} data-testid="grid">
        Content
      </Grid>,
    );
    const el = screen.getByTestId('grid');
    expect(el.style.gridTemplateRows).toBe('repeat(2, minmax(0, 1fr))');
    expect(el.style.minHeight).toBe('100px');
  });

  describe('types (button-provider#8, #27)', () => {
    it('type-checks props against the `as` element', () => {
      const listRef = React.createRef<HTMLOListElement>();
      render(
        <Grid as="ol" ref={listRef} start={2} columns={2} aria-label="Ranking">
          <li>Two</li>
        </Grid>,
      );
      expect(listRef.current).toBe(screen.getByRole('list', { name: 'Ranking' }));

      const elements = [
        // @ts-expect-error start does not exist on the default <div>
        <Grid key="1" start={2} />,
        // @ts-expect-error columns is 1 | 2 | 3 | 4 | 5 | 6 | 12
        <Grid key="2" columns={7} />,
      ];
      expect(elements).toHaveLength(2);
    });

    it('GridProps (0.4 name) is the default-tag props type, extendable, with ref (C-REF)', () => {
      interface GalleryProps extends GridProps {
        dense?: boolean;
      }
      const Gallery = ({ dense, ...props }: GalleryProps) => (
        <Grid gap={dense ? 'xs' : 'lg'} {...props} />
      );
      const ref = React.createRef<HTMLDivElement>();
      render(<Gallery ref={ref} dense data-testid="gallery" />);
      expect(ref.current).toBe(screen.getByTestId('gallery'));

      expectTypeOf<GridProps>().toEqualTypeOf<GridProps<'div'>>();
      expectTypeOf<GridProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
      expectTypeOf<keyof GridOwnProps>().toEqualTypeOf<
        'columns' | 'rows' | 'gap' | 'columnGap' | 'rowGap' | 'align' | 'justify'
      >();
    });
  });
});
