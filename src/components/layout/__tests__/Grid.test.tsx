import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Grid } from '../Grid';
import { testForwardRef, testRestSpread, testClassName, testPolymorphicAs } from '../../../test-utils';

describe('Grid', () => {
  testForwardRef(Grid, 'div');
  testRestSpread(Grid);
  testClassName(Grid);
  testPolymorphicAs(Grid);

  it('renders without crashing', () => {
    render(<Grid data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<Grid>Grid content</Grid>);
    expect(screen.getByText('Grid content')).toBeInTheDocument();
  });

  it('renders as a grid by default', () => {
    render(<Grid data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).toContain('grid');
  });

  it('applies 1 column', () => {
    render(<Grid columns={1} data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).toContain('grid-cols-1');
  });

  it('applies 2 columns', () => {
    render(<Grid columns={2} data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).toContain('grid-cols-2');
  });

  it('applies 3 columns', () => {
    render(<Grid columns={3} data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).toContain('grid-cols-3');
  });

  it('applies 4 columns', () => {
    render(<Grid columns={4} data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).toContain('grid-cols-4');
  });

  it('applies 6 columns', () => {
    render(<Grid columns={6} data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).toContain('grid-cols-6');
  });

  it('applies 12 columns', () => {
    render(<Grid columns={12} data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).toContain('grid-cols-12');
  });

  it('applies rows via inline style', () => {
    render(<Grid rows={3} data-testid="grid">Content</Grid>);
    const el = screen.getByTestId('grid');
    expect(el.style.gridTemplateRows).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('applies gap prop', () => {
    render(<Grid gap="lg" data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).toContain('gap-4');
  });

  it('applies columnGap prop', () => {
    render(<Grid columnGap="sm" data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).toContain('gap-x-2');
  });

  it('applies rowGap prop', () => {
    render(<Grid rowGap="xl" data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).toContain('gap-y-6');
  });

  it('applies align prop', () => {
    render(<Grid align="center" data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).toContain('items-center');
  });

  it('applies justify prop', () => {
    render(<Grid justify="center" data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).toContain('justify-items-center');
  });

  it('renders as custom element via as prop', () => {
    render(<Grid as="section" data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').tagName.toLowerCase()).toBe('section');
  });

  it('does not apply column class when columns is not specified', () => {
    render(<Grid data-testid="grid">Content</Grid>);
    expect(screen.getByTestId('grid').className).not.toMatch(/grid-cols-/);
  });
});
