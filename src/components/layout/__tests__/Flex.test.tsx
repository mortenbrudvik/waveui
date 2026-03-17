import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Flex } from '../Flex';
import { testSystemProps } from '../../../test-utils';

describe('Flex', () => {
  testSystemProps(Flex, {
    expectedTag: 'div',
    displayName: 'Flex',
    polymorphic: true,
  });

  it('renders without crashing', () => {
    render(<Flex data-testid="flex">Content</Flex>);
    expect(screen.getByTestId('flex')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<Flex>Flex content</Flex>);
    expect(screen.getByText('Flex content')).toBeInTheDocument();
  });

  it('renders as flex-row by default', () => {
    render(<Flex data-testid="flex">Content</Flex>);
    const el = screen.getByTestId('flex');
    expect(el.className).toContain('flex-row');
    expect(el.className).toContain('flex');
  });

  it('applies row-reverse direction', () => {
    render(
      <Flex direction="row-reverse" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').className).toContain('flex-row-reverse');
  });

  it('applies column direction', () => {
    render(
      <Flex direction="column" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').className).toContain('flex-col');
  });

  it('applies column-reverse direction', () => {
    render(
      <Flex direction="column-reverse" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').className).toContain('flex-col-reverse');
  });

  it('applies wrap class', () => {
    render(
      <Flex wrap="wrap" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').className).toContain('flex-wrap');
  });

  it('applies nowrap class', () => {
    render(
      <Flex wrap="nowrap" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').className).toContain('flex-nowrap');
  });

  it('applies wrap-reverse class', () => {
    render(
      <Flex wrap="wrap-reverse" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').className).toContain('flex-wrap-reverse');
  });

  it('applies align prop', () => {
    render(
      <Flex align="center" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').className).toContain('items-center');
  });

  it('applies align baseline', () => {
    render(
      <Flex align="baseline" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').className).toContain('items-baseline');
  });

  it('applies justify prop', () => {
    render(
      <Flex justify="between" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').className).toContain('justify-between');
  });

  it('applies gap prop', () => {
    render(
      <Flex gap="lg" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').className).toContain('gap-4');
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
    expect(screen.getByTestId('flex').className).toContain('inline-flex');
  });

  it('applies grow class when grow is true', () => {
    render(
      <Flex grow data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').className).toContain('grow');
  });

  it('applies shrink class when shrink is true', () => {
    render(
      <Flex shrink data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').className).toContain('shrink');
  });

  it('renders as custom element via as prop', () => {
    render(
      <Flex as="nav" data-testid="flex">
        Content
      </Flex>,
    );
    expect(screen.getByTestId('flex').tagName.toLowerCase()).toBe('nav');
  });
});
