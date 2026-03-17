import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from '../Text';
import {
  testForwardRef,
  testRestSpread,
  testClassName,
  testPolymorphicAs,
} from '../../../test-utils';

describe('Text', () => {
  testForwardRef(Text, 'span');
  testRestSpread(Text);
  testClassName(Text);
  testPolymorphicAs(Text);

  it('renders without crashing', () => {
    render(<Text data-testid="text">Hello</Text>);
    expect(screen.getByTestId('text')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<Text>Hello World</Text>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders as span by default', () => {
    render(<Text data-testid="text">Hi</Text>);
    expect(screen.getByTestId('text').tagName.toLowerCase()).toBe('span');
  });

  it('renders as a different element via as prop', () => {
    render(
      <Text as="p" data-testid="text">
        Hi
      </Text>,
    );
    expect(screen.getByTestId('text').tagName.toLowerCase()).toBe('p');
  });

  it.each([
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
  ] as const)('renders variant: %s', (variant) => {
    render(
      <Text variant={variant} data-testid="text">
        Content
      </Text>,
    );
    expect(screen.getByTestId('text')).toBeInTheDocument();
  });

  it('applies font-semibold for weight 600', () => {
    render(
      <Text weight={600} data-testid="text">
        Bold
      </Text>,
    );
    expect(screen.getByTestId('text').className).toContain('font-semibold');
  });

  it('applies font-bold for weight 700', () => {
    render(
      <Text weight={700} data-testid="text">
        Bold
      </Text>,
    );
    expect(screen.getByTestId('text').className).toContain('font-bold');
  });

  it('applies font-normal for weight 400', () => {
    render(
      <Text weight={400} data-testid="text">
        Normal
      </Text>,
    );
    expect(screen.getByTestId('text').className).toContain('font-normal');
  });

  it('does not apply weight class when weight is not provided', () => {
    render(<Text data-testid="text">No weight</Text>);
    const cls = screen.getByTestId('text').className;
    expect(cls).not.toContain('font-normal');
    expect(cls).not.toContain('font-semibold');
    expect(cls).not.toContain('font-bold');
  });
});
