import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stack } from '../Stack';
import { testSystemProps } from '../../../test-utils';

describe('Stack', () => {
  testSystemProps(Stack, {
    expectedTag: 'div',
    displayName: 'Stack',
    polymorphic: true,
  });

  it('renders without crashing', () => {
    render(<Stack data-testid="stack">Content</Stack>);
    expect(screen.getByTestId('stack')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<Stack>Stack content</Stack>);
    expect(screen.getByText('Stack content')).toBeInTheDocument();
  });

  it('renders as vertical flex-col by default', () => {
    render(<Stack data-testid="stack">Content</Stack>);
    const el = screen.getByTestId('stack');
    expect(el.className).toContain('flex-col');
    expect(el.className).toContain('flex');
  });

  it('renders as horizontal flex-row when direction is horizontal', () => {
    render(
      <Stack direction="horizontal" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack').className).toContain('flex-row');
  });

  it('applies default md gap', () => {
    render(<Stack data-testid="stack">Content</Stack>);
    expect(screen.getByTestId('stack').className).toContain('gap-3');
  });

  it('applies none gap', () => {
    render(
      <Stack gap="none" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack').className).toContain('gap-0');
  });

  it('applies xs gap', () => {
    render(
      <Stack gap="xs" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack').className).toContain('gap-1');
  });

  it('applies sm gap', () => {
    render(
      <Stack gap="sm" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack').className).toContain('gap-2');
  });

  it('applies lg gap', () => {
    render(
      <Stack gap="lg" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack').className).toContain('gap-4');
  });

  it('applies xl gap', () => {
    render(
      <Stack gap="xl" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack').className).toContain('gap-6');
  });

  it('applies align prop', () => {
    render(
      <Stack align="center" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack').className).toContain('items-center');
  });

  it('applies justify prop', () => {
    render(
      <Stack justify="between" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack').className).toContain('justify-between');
  });

  it('applies wrap class when wrap is true', () => {
    render(
      <Stack wrap data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack').className).toContain('flex-wrap');
  });

  it('does not apply wrap class when wrap is false', () => {
    render(<Stack data-testid="stack">Content</Stack>);
    expect(screen.getByTestId('stack').className).not.toContain('flex-wrap');
  });

  it('applies inline-flex when inline is true', () => {
    render(
      <Stack inline data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack').className).toContain('inline-flex');
  });

  it('renders as custom element via as prop', () => {
    render(
      <Stack as="section" data-testid="stack">
        Content
      </Stack>,
    );
    expect(screen.getByTestId('stack').tagName.toLowerCase()).toBe('section');
  });
});
